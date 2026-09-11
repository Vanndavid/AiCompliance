import request from 'supertest';
import app from '../server';
import { bearerAuthHeader } from './helpers/auth';
import { HttpError } from '../utils/httpError';

jest.mock('../services/compliance/reviewService', () => ({
  listPendingReviews: jest.fn(),
  submitReview: jest.fn(),
}));

import { listPendingReviews, submitReview } from '../services/compliance/reviewService';

const mockedList = listPendingReviews as jest.MockedFunction<typeof listPendingReviews>;
const mockedSubmit = submitReview as jest.MockedFunction<typeof submitReview>;

const evaluationFixture = {
  id: 'eval-1',
  createdAt: '2026-05-30T00:00:00.000Z',
  modelId: 'gemini-2.5-flash',
  promptVersion: 'compliance-eval-v1',
  llmDecision: 'flagged' as const,
  risk: 'high' as const,
  confidence: 0.91,
  issueType: 'expired_certification',
  explanation: 'The certificate expired last year.',
  evidence: [{ quote: 'Expiry Date: 2025-01-01', page: 1 }],
  ruleHits: [{ code: 'EXPIRED_DOCUMENT', severity: 'high' as const, message: 'Expired' }],
  finalDecision: 'flagged' as const,
  needsReview: true,
  routingReason: 'Deterministic rules flagged this document: EXPIRED_DOCUMENT',
  reviewStatus: 'pending' as const,
  reviewerId: null,
  reviewedAt: null,
  reviewNote: null,
  overrideDecision: null,
};

describe('Review API', () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedSubmit.mockReset();
  });

  it('rejects unauthenticated review queue access', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(401);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('returns pending reviews for the authenticated user', async () => {
    mockedList.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'White Card.pdf',
        status: 'processed',
        storagePath: 'uploads/user/doc.pdf',
        extraction: { expiryDate: '2025-01-01' },
        processingError: null,
        contentHash: null,
        crewMemberId: null,
        opsStatus: 'needs_human' as const,
        evaluation: evaluationFixture,
      },
    ]);

    const res = await request(app).get('/api/reviews').set(bearerAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].evaluation.reviewStatus).toBe('pending');
    expect(mockedList).toHaveBeenCalledWith('test_user_123', undefined);
  });

  it('approves a pending evaluation', async () => {
    mockedSubmit.mockResolvedValue({
      ...evaluationFixture,
      reviewStatus: 'approved',
      reviewerId: 'test_user_123',
      reviewedAt: '2026-05-30T01:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/documents/doc-1/review')
      .set(bearerAuthHeader())
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.reviewStatus).toBe('approved');
    expect(mockedSubmit).toHaveBeenCalledWith(
      'doc-1',
      'test_user_123',
      expect.objectContaining({ action: 'approve' }),
    );
  });

  it('rejects with an override decision', async () => {
    mockedSubmit.mockResolvedValue({
      ...evaluationFixture,
      reviewStatus: 'rejected',
      overrideDecision: 'clear',
      reviewerId: 'test_user_123',
      reviewedAt: '2026-05-30T01:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/documents/doc-1/review')
      .set(bearerAuthHeader())
      .send({ action: 'reject', overrideDecision: 'clear', note: 'Date was a reprint' });

    expect(res.status).toBe(200);
    expect(res.body.evaluation.reviewStatus).toBe('rejected');
    expect(res.body.evaluation.overrideDecision).toBe('clear');
  });

  it('returns 404 when the document is not owned by the user', async () => {
    mockedSubmit.mockRejectedValue(new HttpError(404, 'Document not found'));

    const res = await request(app)
      .post('/api/documents/missing/review')
      .set(bearerAuthHeader())
      .send({ action: 'approve' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when the evaluation is not pending', async () => {
    mockedSubmit.mockRejectedValue(new HttpError(409, 'Evaluation is not pending review'));

    const res = await request(app)
      .post('/api/documents/doc-1/review')
      .set(bearerAuthHeader())
      .send({ action: 'approve' });

    expect(res.status).toBe(409);
  });
});
