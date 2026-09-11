export const EVALUATION_PROMPT_VERSION = 'compliance-eval-v1';

export const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash';

export const getGeminiModelId = () => process.env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID;

/**
 * Single Gemini call: structured extraction (for RAG) plus a compliance
 * evaluation. Keep in sync with lambdaWorker/index.js.
 */
export const DOCUMENT_EVALUATION_PROMPT = `
      You are a strict Compliance Officer. Analyze this document.

      Task:
      1. Identify the Document Type (e.g., White Card, Driver License, insurance certificate).
      2. Extract the Expiry Date (YYYY-MM-DD), or null if not present.
      3. Extract the Issue Date (YYYY-MM-DD), or null if not present.
      4. Extract the License Number.
      5. Extract the Name.
      6. Extract a brief summary of content.
      7. Transcribe the full text of every page, verbatim, in "pages".
         Preserve each label and its value on the same line (e.g. "Expiry Date: 2027-03-14").
         Number pages from 1. This transcription is what question answering reads,
         so do not summarise, reorder, or omit anything from it.
      8. Evaluate compliance (separate from the extracted fields):
         - decision: "clear" if the document appears valid, "flagged" if there is a compliance issue, "uncertain" if you cannot tell
         - risk: "low" | "medium" | "high" (expired high-risk work licences and expired insurance are high)
         - confidence: a number from 0 to 1
         - issueType: "expired_certification", "expired_insurance", "missing_information", "contradictory_dates", "ambiguous", or null if clear
         - explanation: a short reason for the decision
         - evidence: array of { "quote": string, "page": number } quotes from the document that support the decision

      Output ONLY raw JSON. No markdown.
      Structure: { "type": "string", "expiryDate": "string|null", "issueDate": "string|null", "licenseNumber": "string|null", "name": "string", "confidence": number, "content": "string", "pages": [{ "page": number, "text": "string" }], "decision": "clear"|"flagged"|"uncertain", "risk": "low"|"medium"|"high", "issueType": "string|null", "explanation": "string", "evidence": [{ "quote": "string", "page": number }] }
    `;
