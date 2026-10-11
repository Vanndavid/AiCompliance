const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { GoogleGenAI } = require("@google/genai");

// --- 1. SETUP CLIENTS ---
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-4", // Default to Melbourne
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const API_BASE_URL = process.env.WORKER_CALLBACK_API_BASE_URL;
const WORKER_CALLBACK_TOKEN = process.env.WORKER_CALLBACK_TOKEN;

function assertCallbackConfig() {
  if (!API_BASE_URL) {
    throw new Error("WORKER_CALLBACK_API_BASE_URL is required");
  }

  if (!WORKER_CALLBACK_TOKEN) {
    throw new Error("WORKER_CALLBACK_TOKEN is required");
  }
}

function markCallbackError(error) {
  error.callbackFailed = true;
  return error;
}

async function reportProcessingResult(docId, payload) {
  assertCallbackConfig();

  const callbackUrl = new URL(
    `/api/internal/documents/${docId}/processing-result`,
    API_BASE_URL
  ).toString();
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-token": WORKER_CALLBACK_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw markCallbackError(new Error(`Worker callback failed with ${response.status}: ${responseText}`));
  }
}

// --- 3. HELPER: Download from S3 ---
async function getFileFromS3(bucket, key) {
  console.log(`Fetching from S3: ${key}`);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  
  // Convert stream to Buffer (Node.js Stream logic)
  return new Promise((resolve, reject) => {
    const chunks = [];
    response.Body.on("data", (chunk) => chunks.push(chunk));
    response.Body.on("error", reject);
    response.Body.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// --- 4. THE LAMBDA HANDLER ---
exports.handler = async (event) => {
  console.log(`Lambda started. Processing ${event.Records.length} records.`);

  // B. Loop through SQS Messages
  for (const record of event.Records) {
    let docId = null;

    try {
      // 1. Parse Job Data
      const body = JSON.parse(record.body);
      docId = body.docId;
      const key = body.key;      // S3 Key
      const mimeType = body.mimeType;

      console.log(`Processing job: ${docId}`);

      // 2. Download File
      // Note: We use the bucket name from ENV, or assume the key is relative
      const bucketName = process.env.AWS_BUCKET_NAME; 
      const fileBuffer = await getFileFromS3(bucketName, key);
      const base64Data = fileBuffer.toString("base64");

      // 3. Configure Model (GEMINI_MODEL_ID, defaults to gemini-2.5-flash)
      const modelId = process.env.GEMINI_MODEL_ID || "gemini-2.5-flash";
      console.log(`Using Gemini Model: ${modelId}`);
      // Single Gemini call: structured extraction (for RAG) plus a compliance evaluation.
      // Evaluation fields come first so a long page transcription cannot push
      // explanation/decision off the end of the output window.
      // When you change this prompt, bump EVALUATION_PROMPT_VERSION in
      // src/services/compliance/extractionPrompt.ts (currently compliance-eval-v3).

      const prompt = `
        You are a strict Compliance Officer. Analyze this document.
        Task:
        1. Evaluate compliance first:
           - decision: exactly "clear", "flagged", or "uncertain" (not "compliant", "pass", "approved", or a document title)
           - "High Risk Work Licence" is a document class, not a decision or a risk rating.
             A valid, unexpired licence/card with a visible holder, number, and expiry is decision "clear" and risk "low".
           - risk: exactly "low", "medium", or "high". Use "high" only for expired high-risk work licences, expired insurance, or another serious defect.
           - confidence: a JSON number from 0 to 1 for how sure you are about the extracted fields (not a percentage and not a string)
           - issueType: "expired_certification", "expired_insurance", "missing_information", "contradictory_dates", "ambiguous", or null if clear
           - explanation: a short non-empty reason for the decision. Always include this field.
           - evidence: array of { "quote": string, "page": number } quotes from the document that support the decision
        2. Identify the Document Type (e.g., White Card, Driver License, insurance certificate, SWMS).
        3. Extract the Expiry Date (YYYY-MM-DD), or null if not present.
        4. Extract the Issue Date (YYYY-MM-DD), or null if not present.
        5. Extract the License Number, or null if not present.
        6. Extract the Name, or null if not present.
        7. Extract a brief summary of content.
        8. Transcribe the full text of every page, verbatim, in "pages".
           Preserve each label and its value on the same line (e.g. "Expiry Date: 2027-03-14").
           Number pages from 1. This transcription is what question answering reads,
           so do not summarise, reorder, or omit anything from it.

        Output ONLY raw JSON. No markdown.
        Write evaluation fields before pages.
        Structure: { "decision": "clear"|"flagged"|"uncertain", "risk": "low"|"medium"|"high", "confidence": number, "issueType": "string|null", "explanation": "string", "evidence": [{ "quote": "string", "page": number }], "type": "string", "expiryDate": "string|null", "issueDate": "string|null", "licenseNumber": "string|null", "name": "string", "content": "string", "pages": [{ "page": number, "text": "string" }] }
      `;

      // 4. Call AI
      const aiResponse = await ai.models.generateContent({
        model: modelId,
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        }
      });

      // 5. Parse Response
      const parts = aiResponse.candidates && aiResponse.candidates[0] && aiResponse.candidates[0].content
        ? aiResponse.candidates[0].content.parts
        : [];
      const partText = Array.isArray(parts)
        ? parts.map((part) => part.text).filter(Boolean).join("")
        : "";
      const text = aiResponse.text || partText;
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      if (!cleanJson) {
        throw new Error("Empty response from AI");
      }
      const aiResult = JSON.parse(cleanJson);

      console.log(`AI analysis complete for ${docId}`);

      // 6. Report result to API. The API is the only service that writes to Postgres.
      await reportProcessingResult(docId, {
        status: "processed",
        modelId,
        extractedData: aiResult,
      });

      console.log(`Document updated: ${docId}`);

    } catch (error) {
      console.error(`Job failed ${docId}:`, error);

      if (error.callbackFailed) {
        throw error;
      }

      // Report processing failure to API. If this callback fails, throw so SQS retries.
      if (docId) {
        await reportProcessingResult(docId, {
          status: "failed",
          processingError: error && error.message ? String(error.message) : "processing_failed",
        });
      }
    }
  }

  return { statusCode: 200, body: "Batch Complete" };
};
