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

  it('rejects unknown decision values', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, decision: 'nope' })).toThrow(
      /invalid decision/,
    );
  });

  it('normalizes Gemini enum aliases and casing', () => {
    const parsed = parseLlmEvaluation({
      ...validPayload,
      decision: 'Compliant',
      risk: 'Moderate',
    });
    expect(parsed.llmDecision).toBe('clear');
    expect(parsed.risk).toBe('medium');
  });

  it('accepts confidence as a numeric string or 0-100 integer', () => {
    expect(parseLlmEvaluation({ ...validPayload, confidence: '0.85' }).confidence).toBe(0.85);
    expect(parseLlmEvaluation({ ...validPayload, confidence: 85 }).confidence).toBe(0.85);
    expect(parseLlmEvaluation({ ...validPayload, confidence: '90%' }).confidence).toBe(0.9);
  });

  it('rejects confidence outside 0-1', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, confidence: 1.4 })).toThrow(
      /invalid confidence/,
    );
    expect(() => parseLlmEvaluation({ ...validPayload, confidence: -0.1 })).toThrow(
      /invalid confidence/,
    );
    expect(() => parseLlmEvaluation({ ...validPayload, confidence: 140 })).toThrow(
      /invalid confidence/,
    );
  });

  it('rejects a missing explanation', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, explanation: '  ' })).toThrow(
      /missing an explanation/,
    );
  });

  it('accepts reason as an explanation alias', () => {
    const { explanation: _ignored, ...withoutExplanation } = validPayload;
    const parsed = parseLlmEvaluation({
      ...withoutExplanation,
      reason: 'SWMS covers the lift hazards and controls.',
    });
    expect(parsed.explanation).toContain('lift hazards');
  });

  it('rejects evidence that is not a string or array', () => {
    expect(() => parseLlmEvaluation({ ...validPayload, evidence: { quote: 'x' } })).toThrow(
      /malformed evidence/,
    );
  });

  it('coerces string evidence and skips items without a quote', () => {
    const parsed = parseLlmEvaluation({
      ...validPayload,
      evidence: ['Crane radius 30m', { page: 1 }, { text: 'Dogman in radio contact', page: '2' }],
    });
    expect(parsed.evidence).toEqual([
      { quote: 'Crane radius 30m' },
      { quote: 'Dogman in radio contact', page: 2 },
    ]);
  });

  it('accepts a typical Gemini SWMS payload', () => {
    const parsed = parseLlmEvaluation({
      type: 'SWMS',
      expiryDate: null,
      issueDate: '2026-03-01',
      licenseNumber: null,
      name: 'Northside Civil',
      confidence: '0.78',
      content: 'Tower crane lift operations method statement',
      pages: [{ page: '1', text: 'SWMS: Tower Crane Lift Operations' }],
      decision: 'Clear',
      risk: 'medium',
      issueType: null,
      explanation: 'Document is a current SWMS for crane lift operations.',
      evidence: [{ quote: 'Review date: 2027-03-01', page: 1 }],
    });

    expect(parsed.extraction.docType).toBe('SWMS');
    expect(parsed.extraction.holderName).toBe('Northside Civil');
    expect(parsed.extraction.pages[0]).toEqual({
      page: 1,
      text: 'SWMS: Tower Crane Lift Operations',
    });
    expect(parsed.llmDecision).toBe('clear');
    expect(parsed.confidence).toBe(0.78);
  });

  it('defaults omitted evidence to an empty list', () => {
    const { evidence: _ignored, ...withoutEvidence } = validPayload;
    const parsed = parseLlmEvaluation(withoutEvidence);
    expect(parsed.evidence).toEqual([]);
  });
});
