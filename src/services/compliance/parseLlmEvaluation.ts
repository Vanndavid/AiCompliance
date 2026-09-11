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

const DECISION_ALIASES: Record<string, LlmDecision> = {
  clear: 'clear',
  flagged: 'flagged',
  uncertain: 'uncertain',
  compliant: 'clear',
  compliance: 'clear',
  valid: 'clear',
  pass: 'clear',
  passed: 'clear',
  approved: 'clear',
  ok: 'clear',
  okay: 'clear',
  fail: 'flagged',
  failed: 'flagged',
  failure: 'flagged',
  invalid: 'flagged',
  noncompliant: 'flagged',
  non_compliant: 'flagged',
  issue: 'flagged',
  issues: 'flagged',
  unknown: 'uncertain',
  unclear: 'uncertain',
  maybe: 'uncertain',
  ambiguous: 'uncertain',
  n_a: 'uncertain',
  na: 'uncertain',
  cannot_tell: 'uncertain',
  cant_tell: 'uncertain',
};

const RISK_ALIASES: Record<string, RiskLevel> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  min: 'low',
  minimal: 'low',
  none: 'low',
  med: 'medium',
  moderate: 'medium',
  critical: 'high',
  severe: 'high',
  max: 'high',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEnumKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s\-/]+/g, '_');

const parsePositiveInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (parsed > 0) {
      return parsed;
    }
  }
  return undefined;
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
  if (typeof value !== 'string') {
    throw new InvalidLlmOutputError('Model output has an invalid decision');
  }
  const mapped = DECISION_ALIASES[normalizeEnumKey(value)];
  if (!mapped || !LLM_DECISIONS.includes(mapped)) {
    throw new InvalidLlmOutputError('Model output has an invalid decision');
  }
  return mapped;
};

const parseRisk = (value: unknown): RiskLevel => {
  if (typeof value !== 'string') {
    throw new InvalidLlmOutputError('Model output has an invalid risk');
  }
  const mapped = RISK_ALIASES[normalizeEnumKey(value)];
  if (!mapped || !RISK_LEVELS.includes(mapped)) {
    throw new InvalidLlmOutputError('Model output has an invalid risk');
  }
  return mapped;
};

const parseConfidence = (value: unknown): number => {
  let numeric: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    numeric = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim().replace(/%$/, '');
    if (trimmed) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        numeric = parsed;
      }
    }
  }

  if (numeric == null) {
    throw new InvalidLlmOutputError('Model output has an invalid confidence');
  }

  // Gemini often emits 0–100 instead of 0–1.
  if (numeric > 1 && numeric <= 100 && Number.isInteger(numeric)) {
    numeric = numeric / 100;
  }

  if (numeric < 0 || numeric > 1) {
    throw new InvalidLlmOutputError('Model output has an invalid confidence');
  }
  return numeric;
};

const parseEvidenceItem = (item: unknown): EvidenceItem | null => {
  if (typeof item === 'string') {
    const quote = asTrimmedString(item);
    return quote ? { quote } : null;
  }
  if (!isRecord(item)) {
    return null;
  }
  const quote = asTrimmedString(item.quote) ?? asTrimmedString(item.text);
  if (!quote) {
    return null;
  }
  const evidence: EvidenceItem = { quote };
  const page = parsePositiveInt(item.page);
  if (page) {
    evidence.page = page;
  }
  return evidence;
};

const parseEvidence = (value: unknown): EvidenceItem[] => {
  if (value == null) {
    return [];
  }
  if (typeof value === 'string') {
    const quote = asTrimmedString(value);
    return quote ? [{ quote }] : [];
  }
  if (!Array.isArray(value)) {
    throw new InvalidLlmOutputError('Model output has malformed evidence');
  }

  return value.flatMap((item) => {
    const parsed = parseEvidenceItem(item);
    return parsed ? [parsed] : [];
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
    const page = parsePositiveInt(item.page) ?? index + 1;
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

  const explanation = optionalMappedString(record.explanation, record.reason, record.rationale);
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
    llmDecision: parseDecision(record.decision ?? record.llmDecision),
    risk: parseRisk(record.risk),
    confidence,
    issueType,
    explanation,
    evidence: parseEvidence(record.evidence),
  };
};
