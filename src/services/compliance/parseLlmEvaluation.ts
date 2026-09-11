import type { ExtractedDocumentData, ExtractedDocumentPage } from '../../models/Document';
import {
  InvalidLlmOutputError,
  type EvidenceItem,
  type LlmDecision,
  type ParsedLlmEvaluation,
  type RiskLevel,
} from './types';

const LLM_DECISIONS: readonly LlmDecision[] = ['clear', 'flagged', 'uncertain'];
const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseJsonPayload = (input: unknown): Record<string, unknown> => {
  if (typeof input === 'string') {
    const cleaned = input.replace(/```json/gi, '').replace(/```/g, '').trim();
    if (!cleaned) {
      throw new InvalidLlmOutputError('Empty response from AI');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new InvalidLlmOutputError('Model output is not valid JSON');
    }
    if (!isRecord(parsed)) {
      throw new InvalidLlmOutputError('Model output must be a JSON object');
    }
    return parsed;
  }

  if (!isRecord(input)) {
    throw new InvalidLlmOutputError('Model output must be a JSON object');
  }

  return input;
};

const parseDecision = (value: unknown): LlmDecision => {
  if (typeof value !== 'string' || !LLM_DECISIONS.includes(value as LlmDecision)) {
    throw new InvalidLlmOutputError('Model output has an invalid decision');
  }
  return value as LlmDecision;
};

const parseRisk = (value: unknown): RiskLevel => {
  if (typeof value !== 'string' || !RISK_LEVELS.includes(value as RiskLevel)) {
    throw new InvalidLlmOutputError('Model output has an invalid risk');
  }
  return value as RiskLevel;
};

const parseConfidence = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new InvalidLlmOutputError('Model output has an invalid confidence');
  }
  return value;
};

const parseEvidence = (value: unknown): EvidenceItem[] => {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new InvalidLlmOutputError('Model output has malformed evidence');
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new InvalidLlmOutputError(`Evidence item ${index} is malformed`);
    }
    const quote = asTrimmedString(item.quote);
    if (!quote) {
      throw new InvalidLlmOutputError(`Evidence item ${index} is missing a quote`);
    }
    const evidence: EvidenceItem = { quote };
    if (typeof item.page === 'number' && Number.isInteger(item.page) && item.page > 0) {
      evidence.page = item.page;
    }
    return evidence;
  });
};

const parsePages = (value: unknown): ExtractedDocumentPage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }
    const text = typeof item.text === 'string' ? item.text : '';
    const page = typeof item.page === 'number' && Number.isInteger(item.page) && item.page > 0
      ? item.page
      : index + 1;
    return [{ page, text }];
  });
};

const optionalMappedString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const parsed = asTrimmedString(value);
    if (parsed) {
      return parsed;
    }
  }
  return undefined;
};

/**
 * Treat model JSON as untrusted input. Malformed payloads never become
 * extractedData or an evaluation row.
 */
export const parseLlmEvaluation = (input: unknown): ParsedLlmEvaluation => {
  const record = parseJsonPayload(input);

  const explanation = asTrimmedString(record.explanation);
  if (!explanation) {
    throw new InvalidLlmOutputError('Model output is missing an explanation');
  }

  const extraction: ExtractedDocumentData = {
    pages: parsePages(record.pages),
  };

  const docType = optionalMappedString(record.docType, record.type);
  if (docType) {
    extraction.docType = docType;
  }

  const expiryDate = optionalMappedString(record.expiryDate);
  if (expiryDate) {
    extraction.expiryDate = expiryDate;
  }

  const issueDate = optionalMappedString(record.issueDate);
  if (issueDate) {
    extraction.issueDate = issueDate;
  }

  const licenseNumber = optionalMappedString(record.licenseNumber);
  if (licenseNumber) {
    extraction.licenseNumber = licenseNumber;
  }

  const holderName = optionalMappedString(record.holderName, record.name);
  if (holderName) {
    extraction.holderName = holderName;
  }

  const content = optionalMappedString(record.content);
  if (content) {
    extraction.content = content;
  }

  const confidence = parseConfidence(record.confidence);
  extraction.confidence = confidence;

  const issueType = asTrimmedString(record.issueType);

  return {
    extraction,
    llmDecision: parseDecision(record.decision),
    risk: parseRisk(record.risk),
    confidence,
    issueType,
    explanation,
    evidence: parseEvidence(record.evidence),
  };
};
