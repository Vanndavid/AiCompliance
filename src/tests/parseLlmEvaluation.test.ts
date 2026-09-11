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

  it('defaults unknown decision and risk values conservatively', () => {
    const parsed = parseLlmEvaluation({ ...validPayload, decision: 'nope', risk: 'extreme' });
    expect(parsed.llmDecision).toBe('uncertain');
    expect(parsed.risk).toBe('medium');
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

  it('defaults unusable confidence to 0.5', () => {
    expect(parseLlmEvaluation({ ...validPayload, confidence: 1.4 }).confidence).toBe(0.5);
    expect(parseLlmEvaluation({ ...validPayload, confidence: -0.1 }).confidence).toBe(0.5);
    expect(parseLlmEvaluation({ ...validPayload, confidence: 140 }).confidence).toBe(0.5);
    expect(parseLlmEvaluation({ ...validPayload, confidence: undefined }).confidence).toBe(0.5);
  });

  it('synthesizes an explanation when Gemini omits it', () => {
    const parsed = parseLlmEvaluation({
      type: 'SWMS',
      decision: 'clear',
      risk: 'low',
      confidence: 0.9,
    });
    expect(parsed.explanation).toContain('SWMS');
    expect(parsed.llmDecision).toBe('clear');
  });

  it('uses document content when no explanation aliases exist', () => {
    const { explanation: _ignored, ...withoutExplanation } = validPayload;
    const parsed = parseLlmEvaluation(withoutExplanation);
    expect(parsed.explanation).toBe('Construction induction card');
  });

  it('accepts reason as an explanation alias', () => {
    const { explanation: _ignored, ...withoutExplanation } = validPayload;
    const parsed = parseLlmEvaluation({
      ...withoutExplanation,
      reason: 'SWMS covers the lift hazards and controls.',
    });
    expect(parsed.explanation).toContain('lift hazards');
  });

  it('ignores malformed evidence instead of failing the document', () => {
    expect(parseLlmEvaluation({ ...validPayload, evidence: 12 }).evidence).toEqual([]);
    expect(
      parseLlmEvaluation({ ...validPayload, evidence: { quote: 'Lift plan on page 3' } }).evidence,
    ).toEqual([{ quote: 'Lift plan on page 3' }]);
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
    expect(parsed.extraction.pages?.[0]).toEqual({
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

  it('accepts a sparse payload without failing the document', () => {
    const parsed = parseLlmEvaluation({});
    expect(parsed.llmDecision).toBe('uncertain');
    expect(parsed.risk).toBe('medium');
    expect(parsed.confidence).toBe(0.5);
    expect(parsed.explanation).toContain('did not provide an explanation');
  });
});
