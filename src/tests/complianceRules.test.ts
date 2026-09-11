import { evaluateComplianceRules } from '../services/compliance/complianceRules';
import type { ParsedLlmEvaluation } from '../services/compliance/types';

const NOW = new Date('2026-05-30T00:00:00Z');

const baseParsed = (overrides: Partial<ParsedLlmEvaluation> = {}): ParsedLlmEvaluation => {
  const { extraction, ...rest } = overrides;
  return {
    extraction: {
      docType: 'White Card',
      expiryDate: '2027-03-14',
      issueDate: '2023-03-14',
      licenseNumber: 'WC-4471-2290',
      holderName: 'Jordan Mercer',
      confidence: 0.92,
      ...extraction,
    },
    llmDecision: 'clear',
    risk: 'low',
    confidence: 0.92,
    issueType: null,
    explanation: 'Looks valid',
    evidence: [],
    ...rest,
  };
};

describe('evaluateComplianceRules', () => {
  it('returns no hits for a complete unexpired document', () => {
    expect(evaluateComplianceRules(baseParsed(), NOW)).toEqual([]);
  });

  it('flags an expired document', () => {
    const hits = evaluateComplianceRules(
      baseParsed({ extraction: { expiryDate: '2025-01-01' } }),
      NOW,
    );
    expect(hits.map(hit => hit.code)).toContain('EXPIRED_DOCUMENT');
  });

  it('flags missing expiry and license number', () => {
    const parsed = baseParsed();
    delete parsed.extraction.expiryDate;
    delete parsed.extraction.licenseNumber;
    const hits = evaluateComplianceRules(parsed, NOW);
    expect(hits.map(hit => hit.code)).toEqual(
      expect.arrayContaining(['MISSING_EXPIRY', 'MISSING_LICENSE_NUMBER']),
    );
  });

  it('flags an unparseable date', () => {
    const hits = evaluateComplianceRules(
      baseParsed({ extraction: { expiryDate: 'not-a-date' } }),
      NOW,
    );
    expect(hits.map(hit => hit.code)).toContain('INVALID_DATE');
    expect(hits.map(hit => hit.code)).not.toContain('MISSING_EXPIRY');
  });

  it('flags when the issue date is after the expiry date', () => {
    const hits = evaluateComplianceRules(
      baseParsed({
        extraction: { issueDate: '2028-01-01', expiryDate: '2027-03-14' },
      }),
      NOW,
    );
    expect(hits.map(hit => hit.code)).toContain('CONTRADICTORY_DATES');
  });

  it('flags when the model says clear but the expiry is in the past', () => {
    const hits = evaluateComplianceRules(
      baseParsed({
        llmDecision: 'clear',
        extraction: { expiryDate: '2024-12-01' },
      }),
      NOW,
    );
    expect(hits.map(hit => hit.code)).toEqual(
      expect.arrayContaining(['EXPIRED_DOCUMENT', 'LLM_DATE_MISMATCH']),
    );
  });
});
