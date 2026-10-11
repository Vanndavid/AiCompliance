/**
 * The extraction + evaluation prompt lives in lambdaWorker/index.js, the only
 * place Gemini is called for documents. Bump this whenever that prompt changes,
 * so each stored DocumentEvaluation records which prompt produced it.
 */
export const EVALUATION_PROMPT_VERSION = 'compliance-eval-v3';

export const DEFAULT_GEMINI_MODEL_ID = 'gemini-2.5-flash';

export const getGeminiModelId = () => process.env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID;
