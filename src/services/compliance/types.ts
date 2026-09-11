import type { ExtractedDocumentData } from '../../models/Document';

export type LlmDecision = 'clear' | 'flagged' | 'uncertain';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ComplianceDecision = 'clear' | 'flagged';
export type ReviewStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export type EvidenceItem = {
  quote: string;
  page?: number;
};

export type ParsedLlmEvaluation = {
  extraction: ExtractedDocumentData;
  llmDecision: LlmDecision;
  risk: RiskLevel;
  confidence: number;
  issueType: string | null;
  explanation: string;
  evidence: EvidenceItem[];
};

export type RuleHit = {
  code: string;
  severity: RiskLevel;
  message: string;
};

export type RoutingResult = {
  finalDecision: ComplianceDecision;
  needsReview: boolean;
  reviewStatus: ReviewStatus;
  routingReason: string;
};

export type EvaluationDecision = {
  parsed: ParsedLlmEvaluation;
  ruleHits: RuleHit[];
  routing: RoutingResult;
};

export class InvalidLlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLlmOutputError';
  }
}
