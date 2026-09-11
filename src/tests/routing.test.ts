import { HIGH_CONFIDENCE, UNCERTAIN_CONFIDENCE, routeEvaluation } from '../services/compliance/routing';
import type { ParsedLlmEvaluation, RuleHit } from '../services/compliance/types';

const clearParsed = (overrides: Partial<ParsedLlmEvaluation> = {}): ParsedLlmEvaluation => ({
  extraction: {
    docType: 'White Card',
    expiryDate: '2027-03-14',
    licenseNumber: 'WC-1',
  },
  llmDecision: 'clear',
  risk: 'low',
  confidence: 0.95,
  issueType: null,
  explanation: 'Valid',
  evidence: [],
  ...overrides,
});

const expiredRule: RuleHit = {
  code: 'EXPIRED_DOCUMENT',
  severity: 'high',
  message: 'Expired',
};

describe('routeEvaluation', () => {
  it('auto-clears high-confidence, low-risk results with no rule hits', () => {
    const result = routeEvaluation(clearParsed(), []);
    expect(result.finalDecision).toBe('clear');
    expect(result.needsReview).toBe(false);
    expect(result.reviewStatus).toBe('not_required');
    expect(result.routingReason).toMatch(/High-confidence/);
  });

  it('sends rule hits to review even when the model is clear', () => {
    const result = routeEvaluation(clearParsed(), [expiredRule]);
    expect(result.finalDecision).toBe('flagged');
    expect(result.needsReview).toBe(true);
    expect(result.reviewStatus).toBe('pending');
    expect(result.routingReason).toContain('EXPIRED_DOCUMENT');
  });

  it('flags low-confidence results for review', () => {
    const result = routeEvaluation(clearParsed({ confidence: UNCERTAIN_CONFIDENCE - 0.1 }), []);
    expect(result.finalDecision).toBe('flagged');
    expect(result.needsReview).toBe(true);
  });

  it('flags high-risk results for review', () => {
    const result = routeEvaluation(clearParsed({ risk: 'high' }), []);
    expect(result.finalDecision).toBe('flagged');
    expect(result.routingReason).toMatch(/High-risk/);
  });

  it('flags uncertain model decisions for review', () => {
    const result = routeEvaluation(clearParsed({ llmDecision: 'uncertain', confidence: 0.7 }), []);
    expect(result.finalDecision).toBe('flagged');
    expect(result.reviewStatus).toBe('pending');
  });

  it('does not auto-clear mid-confidence medium-risk results', () => {
    const result = routeEvaluation(
      clearParsed({ risk: 'medium', confidence: HIGH_CONFIDENCE - 0.05 }),
      [],
    );
    expect(result.finalDecision).toBe('flagged');
    expect(result.needsReview).toBe(true);
  });
});
