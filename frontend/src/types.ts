export interface AiExtraction {
  docType?: string;
  expiryDate?: string;
  issueDate?: string;
  licenseNumber?: string;
  holderName?: string;
  confidence?: number;
  content?: string;
}

export interface EvaluationEvidence {
  quote: string;
  page?: number;
}

export interface RuleHit {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface DocumentEvaluation {
  id: string;
  createdAt: string;
  modelId: string;
  promptVersion: string;
  llmDecision: 'clear' | 'flagged' | 'uncertain';
  risk: 'low' | 'medium' | 'high';
  confidence: number;
  issueType: string | null;
  explanation: string;
  evidence: EvaluationEvidence[];
  ruleHits: RuleHit[];
  finalDecision: 'clear' | 'flagged';
  needsReview: boolean;
  routingReason: string;
  reviewStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  overrideDecision: 'clear' | 'flagged' | null;
}

export interface ProjectItem {
  id: number;
  name: string;
  description?: string | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  status: 'uploading' | 'pending' | 'processed' | 'failed';
  storagePath: string;
  extraction?: AiExtraction;
  processingError?: string | null;
  evaluation?: DocumentEvaluation | null;
  matchReasons?: string[];
  contentHash?: string | null;
  crewMemberId?: string | null;
  opsStatus?: OpsStatus;
}

export type OpsStatus = 'processing' | 'failed' | 'needs_human' | 'expired' | 'expiring' | 'valid';

export interface CrewMemberItem {
  id: string | null;
  name: string;
  email: string | null;
  status: OpsStatus;
  documents: DocumentItem[];
}

export interface CrewOverviewTotals {
  expired: number;
  expiringSoon: number;
  siteReady: number;
  needsHuman: number;
  processing: number;
  failed: number;
  people: number;
  documents: number;
}

export interface CrewResponse {
  overview: {
    generatedAt: string;
    filters: { expiringWithinDays: number };
    totals: CrewOverviewTotals;
  };
  crew: CrewMemberItem[];
}

export interface SearchResponse {
  query: string;
  interpretedFilters: {
    keywords: string[];
    expiryWithinDays: number | null;
  };
  results: DocumentItem[];
}

export interface NotificationItem {
  id: string;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: string;
  crewMemberId: string | null;
  crewMemberName: string | null;
  documentId: string;
  expiryDate: string | null;
  docType: string | null;
  nextAction: 'remind';
  emailSentAt: string | null;
}

export interface AnswerCitation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  /** False when the documents do not cover the question. */
  answered: boolean;
  citations: AnswerCitation[];
  retrieval: {
    mode: 'vector' | 'keyword' | 'hybrid';
    chunkIds: string[];
  };
}
