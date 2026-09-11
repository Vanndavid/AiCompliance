// Runs the synthetic compliance dataset through parse → rules → route.
//
//   npm run eval:compliance
//
// This does not call Gemini. It measures whether the decision pipeline still
// agrees with the labelled outcomes after a prompt, parser, rule, or threshold
// change. A small synthetic set is not production accuracy.

import fs from 'fs';
import path from 'path';
import { parseLlmEvaluation } from '../../src/services/compliance/parseLlmEvaluation';
import { evaluateParsedLlm } from '../../src/services/compliance/evaluateParsedLlm';
import { EVALUATION_PROMPT_VERSION } from '../../src/services/compliance/extractionPrompt';
import { COMPLIANCE_EVAL_CASES } from './dataset';

const NOW = new Date('2026-05-30T00:00:00Z');

type Outcome = {
  id: string;
  note: string;
  parsed: boolean;
  predictedDecision: 'clear' | 'flagged' | 'invalid';
  goldDecision: 'clear' | 'flagged';
  correct: boolean;
  falsePositive: boolean;
  falseNegative: boolean;
  needsReview: boolean | null;
  routingReason: string | null;
  ruleHits: string[];
};

const main = () => {
  const outcomes: Outcome[] = COMPLIANCE_EVAL_CASES.map(testCase => {
    try {
      const parsed = parseLlmEvaluation(testCase.llmOutput);
      const { ruleHits, routing } = evaluateParsedLlm(parsed, NOW);
      const predicted = routing.finalDecision;
      const gold = testCase.gold.finalDecision;
      return {
        id: testCase.id,
        note: testCase.note,
        parsed: true,
        predictedDecision: predicted,
        goldDecision: gold,
        correct: predicted === gold,
        falsePositive: predicted === 'flagged' && gold === 'clear',
        falseNegative: predicted === 'clear' && gold === 'flagged',
        needsReview: routing.needsReview,
        routingReason: routing.routingReason,
        ruleHits: ruleHits.map(hit => hit.code),
      };
    } catch (error) {
      return {
        id: testCase.id,
        note: testCase.note,
        parsed: false,
        predictedDecision: 'invalid',
        goldDecision: testCase.gold.finalDecision,
        correct: false,
        falsePositive: false,
        falseNegative: testCase.gold.finalDecision === 'flagged',
        needsReview: null,
        routingReason: error instanceof Error ? error.message : 'parse_failed',
        ruleHits: [],
      };
    }
  });

  const total = outcomes.length;
  const correct = outcomes.filter(outcome => outcome.correct).length;
  const falsePositives = outcomes.filter(outcome => outcome.falsePositive).length;
  const falseNegatives = outcomes.filter(outcome => outcome.falseNegative).length;

  const report = {
    runAt: new Date().toISOString(),
    promptVersion: EVALUATION_PROMPT_VERSION,
    now: NOW.toISOString(),
    disclaimer:
      'Engineering harness only. These scores are not production model accuracy.',
    totals: {
      cases: total,
      correct,
      accuracy: total === 0 ? 0 : correct / total,
      falsePositives,
      falseNegatives,
    },
    outcomes,
  };

  console.log(`Compliance eval (${EVALUATION_PROMPT_VERSION})`);
  console.log(`  cases:           ${total}`);
  console.log(`  correct:         ${correct}/${total} (${(report.totals.accuracy * 100).toFixed(1)}%)`);
  console.log(`  false positives: ${falsePositives}`);
  console.log(`  false negatives: ${falseNegatives}`);
  for (const outcome of outcomes) {
    const mark = outcome.correct ? 'ok' : 'FAIL';
    console.log(`  [${mark}] ${outcome.id} → ${outcome.predictedDecision} (gold ${outcome.goldDecision})`);
  }

  const outputPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outputPath}`);

  if (falseNegatives > 0 || correct < total) {
    process.exitCode = 1;
  }
};

main();
