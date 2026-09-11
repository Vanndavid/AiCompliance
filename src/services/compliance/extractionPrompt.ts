export const EVALUATION_PROMPT_VERSION = 'compliance-eval-v2';

export const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash';

export const getGeminiModelId = () => process.env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID;

export const GEMINI_EVALUATION_CONFIG = {
  responseMimeType: 'application/json' as const,
  maxOutputTokens: 8192,
  thinkingConfig: { thinkingBudget: 0 },
};

/**
 * Single Gemini call: structured extraction (for RAG) plus a compliance
 * evaluation. Keep in sync with lambdaWorker/index.js.
 *
 * Evaluation fields are listed first so a long page transcription cannot
 * push explanation/decision off the end of the output window.
 */
export const DOCUMENT_EVALUATION_PROMPT = `
      You are a strict Compliance Officer. Analyze this document.

      Task:
      1. Evaluate compliance first:
         - decision: exactly "clear", "flagged", or "uncertain" (not "compliant", "pass", or "approved")
         - risk: exactly "low", "medium", or "high" (expired high-risk work licences and expired insurance are high)
         - confidence: a JSON number from 0 to 1 (not a percentage and not a string)
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
