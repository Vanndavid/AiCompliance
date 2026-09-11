import { Request, Response } from 'express';
import { getRequestUserId } from '../utils/authUtils';
import { isHttpError } from '../utils/httpError';
import { listPendingReviews, submitReview } from '../services/compliance/reviewService';
import type { ComplianceDecision } from '../services/compliance/types';
import { parsePositiveInt } from '../utils/numberUtils';

export const getPendingReviews = async (req: Request, res: Response) => {
  try {
    const userId = getRequestUserId(req);
    const rawProjectId = req.query.projectId;
    const projectId =
      typeof rawProjectId === 'string'
        ? parsePositiveInt(rawProjectId, 0) || undefined
        : undefined;
    const reviews = await listPendingReviews(userId, projectId);
    res.json({ reviews });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const reviewDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Document id is required' });
    }

    const userId = getRequestUserId(req);
    const { action, note, overrideDecision } = req.body as {
      action?: 'approve' | 'reject';
      note?: string;
      overrideDecision?: ComplianceDecision;
    };

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const evaluation = await submitReview(id, userId, { action, note, overrideDecision });
    res.json({ success: true, evaluation });
  } catch (error) {
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
};
