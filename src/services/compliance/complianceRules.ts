import type { ParsedLlmEvaluation, RuleHit } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const calendarUtc = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * Parse a date used by deterministic rules. Empty is "missing"; a non-empty
 * value that cannot be interpreted is "invalid".
 */
export const parseRuleDate = (value?: string | undefined): Date | null | 'invalid' => {
  if (!value || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(ISO_DATE);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return 'invalid';
    }
    return parsed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return 'invalid';
  }
  return parsed;
};

/**
 * Calendar facts live here, not in the model. Any hit escalates the case
 * regardless of what Gemini decided.
 */
export const evaluateComplianceRules = (
  parsed: ParsedLlmEvaluation,
  now: Date = new Date(),
): RuleHit[] => {
  const hits: RuleHit[] = [];
  const { extraction, llmDecision } = parsed;
  const expiryParsed = parseRuleDate(extraction.expiryDate);
  const issueParsed = parseRuleDate(extraction.issueDate);

  if (expiryParsed === 'invalid') {
    hits.push({
      code: 'INVALID_DATE',
      severity: 'medium',
      message: 'Expiry date could not be parsed',
    });
  } else if (expiryParsed == null) {
    hits.push({
      code: 'MISSING_EXPIRY',
      severity: 'medium',
      message: 'Required expiry date is missing',
    });
  } else if (calendarUtc(expiryParsed) < calendarUtc(now)) {
    hits.push({
      code: 'EXPIRED_DOCUMENT',
      severity: 'high',
      message: 'Document expiry date is in the past',
    });
  }

  if (issueParsed === 'invalid') {
    hits.push({
      code: 'INVALID_DATE',
      severity: 'medium',
      message: 'Issue date could not be parsed',
    });
  }

  if (expiryParsed instanceof Date && issueParsed instanceof Date && calendarUtc(issueParsed) > calendarUtc(expiryParsed)) {
    hits.push({
      code: 'CONTRADICTORY_DATES',
      severity: 'high',
      message: 'Issue date is after the expiry date',
    });
  }

  if (!extraction.licenseNumber) {
    hits.push({
      code: 'MISSING_LICENSE_NUMBER',
      severity: 'medium',
      message: 'License or certificate number is missing',
    });
  }

  if (llmDecision === 'clear' && expiryParsed instanceof Date && calendarUtc(expiryParsed) < calendarUtc(now)) {
    hits.push({
      code: 'LLM_DATE_MISMATCH',
      severity: 'high',
      message: 'Model marked the document clear but the expiry date is in the past',
    });
  }

  return hits;
};
