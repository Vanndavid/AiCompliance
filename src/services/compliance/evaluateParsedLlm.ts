import { evaluateComplianceRules } from './complianceRules';
import { routeEvaluation } from './routing';
import type { EvaluationDecision, ParsedLlmEvaluation } from './types';

export const evaluateParsedLlm = (
  parsed: ParsedLlmEvaluation,
  now: Date = new Date(),
): EvaluationDecision => {
  const ruleHits = evaluateComplianceRules(parsed, now);
  const routing = routeEvaluation(parsed, ruleHits);
  return { parsed, ruleHits, routing };
};
