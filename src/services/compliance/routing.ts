import type { ParsedLlmEvaluation, RoutingResult, RuleHit } from './types';

export const HIGH_CONFIDENCE = 0.8;
export const UNCERTAIN_CONFIDENCE = 0.5;

const flaggedForReview = (routingReason: string): RoutingResult => ({
  finalDecision: 'flagged',
  needsReview: true,
  reviewStatus: 'pending',
  routingReason,
});

/**
 * Combine model judgement with deterministic rules. High-confidence, low-risk
 * clear results may auto-complete; everything else enters the review queue.
 */
export const routeEvaluation = (
  parsed: ParsedLlmEvaluation,
  ruleHits: RuleHit[],
): RoutingResult => {
  if (ruleHits.length > 0) {
    return flaggedForReview(
      `Deterministic rules flagged this document: ${ruleHits.map(hit => hit.code).join(', ')}`,
    );
  }

  if (parsed.llmDecision === 'flagged') {
    return flaggedForReview('Model flagged a compliance issue');
  }

  if (parsed.risk === 'high') {
    return flaggedForReview('High-risk evaluation requires human review');
  }

  if (parsed.llmDecision === 'uncertain') {
    return flaggedForReview('Model was uncertain');
  }

  if (parsed.confidence < UNCERTAIN_CONFIDENCE) {
    return flaggedForReview(
      `Model confidence ${parsed.confidence} is below the review threshold (${UNCERTAIN_CONFIDENCE})`,
    );
  }

  if (parsed.llmDecision === 'clear' && parsed.risk === 'low' && parsed.confidence >= HIGH_CONFIDENCE) {
    return {
      finalDecision: 'clear',
      needsReview: false,
      reviewStatus: 'not_required',
      routingReason: 'High-confidence, low-risk clear result with no rule hits',
    };
  }

  return flaggedForReview('Evaluation is not high-confidence enough to auto-clear');
};
