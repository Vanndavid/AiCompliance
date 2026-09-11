import prisma from '../../config/prisma';
import { HttpError } from '../../utils/httpError';
import { formatEvaluation, formatDocumentListItem, latestEvaluation } from '../../utils/documentFormatter';
import type { ComplianceDecision } from './types';

export type ReviewAction = 'approve' | 'reject';

export type SubmitReviewInput = {
  action: ReviewAction;
  note?: string | undefined;
  overrideDecision?: ComplianceDecision | undefined;
};

export const listPendingReviews = async (userId: string, projectId?: number) => {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      ...(projectId != null ? { projectId } : {}),
    },
    orderBy: { uploadDate: 'desc' },
    include: {
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return documents.flatMap(doc => {
    const evaluation = latestEvaluation(doc);
    if (!evaluation || evaluation.reviewStatus !== 'pending') {
      return [];
    }
    return [{
      ...formatDocumentListItem(doc),
      evaluation: formatEvaluation(evaluation),
    }];
  });
};

export const submitReview = async (documentId: string, userId: string, input: SubmitReviewInput) => {
  if (input.action !== 'approve' && input.action !== 'reject') {
    throw new HttpError(400, 'Invalid review action');
  }

  if (input.action === 'reject' && input.overrideDecision !== 'clear' && input.overrideDecision !== 'flagged') {
    throw new HttpError(400, 'overrideDecision is required when rejecting');
  }

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: {
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!document) {
    throw new HttpError(404, 'Document not found');
  }

  const evaluation = latestEvaluation(document);
  if (!evaluation) {
    throw new HttpError(404, 'No evaluation found');
  }

  if (evaluation.reviewStatus !== 'pending') {
    throw new HttpError(409, 'Evaluation is not pending review');
  }

  const updated = await prisma.documentEvaluation.update({
    where: { id: evaluation.id },
    data: {
      reviewStatus: input.action === 'approve' ? 'approved' : 'rejected',
      reviewerId: userId,
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() ? input.note.trim() : null,
      overrideDecision: input.action === 'reject' && input.overrideDecision
        ? input.overrideDecision
        : null,
    },
  });

  return formatEvaluation(updated);
};
