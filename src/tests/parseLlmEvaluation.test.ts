import { parseLlmEvaluation } from '../services/compliance/parseLlmEvaluation';
import { InvalidLlmOutputError } from '../services/compliance/types';

const validPayload = {
  type: 'White Card',
  expiryDate: '2027-03-14',
  issueDate: '2023-03-14',
  licenseNumber: 'WC-4471-2290',
  name: 'Jordan Mercer',
  confidence: 0.92,
  content: 'Construction induction card',
  pages: [{ page: 1, text: 'Expiry Date: 2027-03-14' }],
  decision: 'clear',
  risk: 'low',
  issueType: null,
  explanation: 'All required fields are present and the card has not expired.',
  evidence: [{ quote: 'Expiry Date: 2027-03-14', page: 1 }],
};

describe('parseLlmEvaluation', () => {
  it('accepts a valid model payload and maps extraction fields', () => {
    const parsed = parseLlmEvaluation(validPayload);

    expect(parsed.extraction.docType).toBe('White Card');
    expect(parsed.extraction.holderName).toBe('Jordan Mercer');
    expect(parsed.extraction.expiryDate).toBe('2027-03-14');
    expect(parsed.extraction.issueDate).toBe('2023-03-14');
    expect(parsed.extraction.licenseNumber).toBe('WC-4471-2290');
    expect(parsed.llmDecision).toBe('clear');
    expect(parsed.risk).toBe('low');
    expect(parsed.confidence).toBe(0.92);
    expect(parsed.issueType).toBeNull();
    expect(parsed.explanation).toContain('not expired');
    expect(parsed.evidence).toEqual([{ quote: 'Expiry Date: 2027-03-14', page: 1 }]);
  });

  it('accepts already-mapped docType and holderName keys', () => {
    const { type: _type, name: _name, ...rest } = validPayload;
    const parsed = parseLlmEvaluation({
      ...rest,
      docType: 'Public Liability',
      holderName: 'Northside Civil',
    });

    expect(parsed.extraction.docType).toBe('Public Liability');
    expect(parsed.extraction.holderName).toBe('Northside Civil');
  });

  it('parses a JSON string and ignores unknown extra fields', () => {
    const parsed = parseLlmEvaluation(JSON.stringify({ ...validPayload, extra: 'noise' }));
    expect(parsed.llmDecision).toBe('clear');
    expect((parsed.extraction as { extra?: string }).extra).toBeUndefined();
  });

  it('rejects malformed JSON', () => {
    expect(() => parseLlmEvaluation('{ not json')).toThrow(InvalidLlmOutputError);
  });

  it('rejects missing decision enums', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, decision: 'maybe' })).toThrow(
      /invalid decision/,
    );
  });

  it('rejects confidence outside 0-1', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, confidence: 1.4 })).toThrow(
      /invalid confidence/,
    );
    expect(() => parseLlmEvaluation({ ...validPayload, confidence: -0.1 })).toThrow(
      /invalid confidence/,
    );
  });

  it('rejects a missing explanation', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, explanation: '  ' })).toThrow(
      /missing an explanation/,
    );
  });

  it('rejects malformed evidence', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, evidence: 'a quote' })).toThrow(
      /malformed evidence/,
    );
    expect(() => parseLlmEvaluation({ ...validPayload, evidence: [{ page: 1 }] })).toThrow(
      /missing a quote/,
    );
  });

  it('defaults omitted evidence to an empty list', () => {
    const { evidence: _ignored, ...withoutEvidence } = validPayload;
    const parsed = parseLlmEvaluation(withoutEvidence);
    expect(parsed.evidence).toEqual([]);
  });
});
