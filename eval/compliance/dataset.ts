// Synthetic model-shaped JSON plus gold routing labels.
// This is an engineering harness for parser/rules/routing regressions, not a
// claim about production model accuracy.

export type ComplianceEvalCase = {
  id: string;
  note: string;
  llmOutput: Record<string, unknown>;
  gold: {
    finalDecision: 'clear' | 'flagged';
    needsReview: boolean;
  };
};

export const COMPLIANCE_EVAL_CASES: ComplianceEvalCase[] = [
  {
    id: 'valid-document',
    note: 'Complete unexpired white card with a high-confidence clear evaluation',
    llmOutput: {
      type: 'White Card',
      expiryDate: '2027-03-14',
      issueDate: '2023-03-14',
      licenseNumber: 'WC-4471-2290',
      name: 'Jordan Mercer',
      confidence: 0.94,
      content: 'Construction induction card',
      pages: [{ page: 1, text: 'Expiry Date: 2027-03-14\nCard Number: WC-4471-2290' }],
      decision: 'clear',
      risk: 'low',
      issueType: null,
      explanation: 'All required fields are present and the card has not expired.',
      evidence: [{ quote: 'Expiry Date: 2027-03-14', page: 1 }],
    },
    gold: { finalDecision: 'clear', needsReview: false },
  },
  {
    id: 'expired-certification',
    note: 'Expired white card. Rules must flag even if the model is optimistic.',
    llmOutput: {
      type: 'White Card',
      expiryDate: '2025-01-01',
      issueDate: '2022-01-01',
      licenseNumber: 'WC-1000',
      name: 'Alex Chen',
      confidence: 0.91,
      content: 'Expired induction card',
      pages: [{ page: 1, text: 'Expiry Date: 2025-01-01' }],
      decision: 'clear',
      risk: 'low',
      issueType: null,
      explanation: 'Looks like a standard white card.',
      evidence: [{ quote: 'Expiry Date: 2025-01-01', page: 1 }],
    },
    gold: { finalDecision: 'flagged', needsReview: true },
  },
  {
    id: 'missing-information',
    note: 'No expiry date and no licence number',
    llmOutput: {
      type: 'Driver Licence',
      expiryDate: null,
      issueDate: null,
      licenseNumber: null,
      name: 'Sam Reid',
      confidence: 0.4,
      content: 'Blurry photo of a licence',
      pages: [{ page: 1, text: 'Driver Licence\nName: Sam Reid' }],
      decision: 'uncertain',
      risk: 'medium',
      issueType: 'missing_information',
      explanation: 'Cannot find an expiry date or licence number.',
      evidence: [{ quote: 'Name: Sam Reid', page: 1 }],
    },
    gold: { finalDecision: 'flagged', needsReview: true },
  },
  {
    id: 'contradictory-dates',
    note: 'Issue date is after the printed expiry date',
    llmOutput: {
      type: 'White Card',
      expiryDate: '2026-02-01',
      issueDate: '2027-06-01',
      licenseNumber: 'WC-8899',
      name: 'Priya Nair',
      confidence: 0.7,
      content: 'Dates do not line up',
      pages: [{ page: 1, text: 'Date of Issue: 2027-06-01\nExpiry Date: 2026-02-01' }],
      decision: 'flagged',
      risk: 'medium',
      issueType: 'contradictory_dates',
      explanation: 'The issue date is after the expiry date.',
      evidence: [{ quote: 'Date of Issue: 2027-06-01', page: 1 }],
    },
    gold: { finalDecision: 'flagged', needsReview: true },
  },
  {
    id: 'ambiguous-information',
    note: 'Fields are present but the model is uncertain and only moderately confident',
    llmOutput: {
      type: 'Public Liability Certificate',
      expiryDate: '2027-11-20',
      issueDate: '2026-11-20',
      licenseNumber: 'PL-44021',
      name: 'Northside Civil Pty Ltd',
      confidence: 0.62,
      content: 'Certificate of currency, stamp partly obscured',
      pages: [{ page: 1, text: 'Expiry Date: 2027-11-20\nPolicy Number: PL-44021' }],
      decision: 'uncertain',
      risk: 'medium',
      issueType: 'ambiguous',
      explanation: 'Stamp is partly obscured so the expiry may be a reprint.',
      evidence: [{ quote: 'Expiry Date: 2027-11-20', page: 1 }],
    },
    gold: { finalDecision: 'flagged', needsReview: true },
  },
  {
    id: 'high-risk-expired-licence',
    note: 'Expired high-risk work licence. High severity, must enter review.',
    llmOutput: {
      type: 'High Risk Work Licence',
      expiryDate: '2024-08-15',
      issueDate: '2019-08-15',
      licenseNumber: 'HRWL-7781',
      name: 'Morgan Blake',
      confidence: 0.88,
      content: 'High risk work licence for scaffolding',
      pages: [{ page: 1, text: 'High Risk Work Licence\nExpiry Date: 2024-08-15' }],
      decision: 'flagged',
      risk: 'high',
      issueType: 'expired_certification',
      explanation: 'The high-risk work licence expired in 2024.',
      evidence: [{ quote: 'Expiry Date: 2024-08-15', page: 1 }],
    },
    gold: { finalDecision: 'flagged', needsReview: true },
  },
];
