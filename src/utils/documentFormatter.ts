import type { Document, DocumentEvaluation, Prisma } from '@prisma/client';
import type { EvidenceItem, RuleHit } from '../services/compliance/types';
import { documentOpsStatus } from './opsStatus';

export type DocumentWithLatestEvaluation = Document & {
  evaluations?: DocumentEvaluation[];
};

const asEvidence = (value: Prisma.JsonValue): EvidenceItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (typeof record.quote !== 'string' || !record.quote.trim()) {
      return [];
    }
    const evidence: EvidenceItem = { quote: record.quote };
    if (typeof record.page === 'number') {
      evidence.page = record.page;
    }
    return [evidence];
  });
};

const asRuleHits = (value: Prisma.JsonValue): RuleHit[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (typeof record.code !== 'string' || typeof record.message !== 'string') {
      return [];
    }
    const severity =
      record.severity === 'low' || record.severity === 'medium' || record.severity === 'high'
        ? record.severity
        : 'medium';
    return [{ code: record.code, severity, message: record.message }];
  });
};

export type FormattedEvaluation = {
  id: string;
  createdAt: string;
  modelId: string;
  promptVersion: string;
  llmDecision: DocumentEvaluation['llmDecision'];
  risk: DocumentEvaluation['risk'];
  confidence: number;
  issueType: string | null;
  explanation: string;
  evidence: EvidenceItem[];
  ruleHits: RuleHit[];
  finalDecision: DocumentEvaluation['finalDecision'];
  needsReview: boolean;
  routingReason: string;
  reviewStatus: DocumentEvaluation['reviewStatus'];
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  overrideDecision: DocumentEvaluation['overrideDecision'] | null;
};

export const formatEvaluation = (evaluation: DocumentEvaluation): FormattedEvaluation => ({
  id: evaluation.id,
  createdAt: evaluation.createdAt.toISOString(),
  modelId: evaluation.modelId,
  promptVersion: evaluation.promptVersion,
  llmDecision: evaluation.llmDecision,
  risk: evaluation.risk,
  confidence: evaluation.confidence,
  issueType: evaluation.issueType,
  explanation: evaluation.explanation,
  evidence: asEvidence(evaluation.evidence),
  ruleHits: asRuleHits(evaluation.ruleHits),
  finalDecision: evaluation.finalDecision,
  needsReview: evaluation.needsReview,
  routingReason: evaluation.routingReason,
  reviewStatus: evaluation.reviewStatus,
  reviewerId: evaluation.reviewerId,
  reviewedAt: evaluation.reviewedAt ? evaluation.reviewedAt.toISOString() : null,
  reviewNote: evaluation.reviewNote,
  overrideDecision: evaluation.overrideDecision,
});

export const latestEvaluation = (doc: DocumentWithLatestEvaluation) =>
  doc.evaluations && doc.evaluations.length > 0 ? doc.evaluations[0] : undefined;

export const formatDocumentListItem = (doc: DocumentWithLatestEvaluation) => {
  const evaluation = latestEvaluation(doc);
  const formattedEvaluation = evaluation ? formatEvaluation(evaluation) : null;
  const extraction = doc.extractedData as { expiryDate?: string } | null;
  return {
    id: doc.id,
    name: doc.originalName,
    status: doc.status,
    storagePath: doc.storagePath,
    extraction: doc.extractedData,
    processingError: doc.processingError,
    evaluation: formattedEvaluation,
    contentHash: doc.contentHash ?? null,
    crewMemberId: doc.crewMemberId ?? null,
    opsStatus: documentOpsStatus({
      status: doc.status,
      extraction,
      evaluation: formattedEvaluation,
    }),
  };
};
