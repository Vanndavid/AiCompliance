import request from 'supertest';
import app from '../server';

jest.mock('../services/compliance/applyProcessingResult', () => ({
  applyProcessingResult: jest.fn(),
  INVALID_MODEL_OUTPUT: 'invalid_model_output',
}));

import { applyProcessingResult } from '../services/compliance/applyProcessingResult';

const mockedApply = applyProcessingResult as jest.MockedFunction<typeof applyProcessingResult>;

const WORKER_TOKEN = 'test-worker-token';

describe('POST /api/internal/documents/:id/processing-result', () => {
  beforeEach(() => {
    process.env.WORKER_CALLBACK_TOKEN = WORKER_TOKEN;
    mockedApply.mockReset();
  });

  it('rejects missing worker token', async () => {
    const res = await request(app)
      .post('/api/internal/documents/doc-1/processing-result')
      .send({ status: 'processed', extractedData: {} });

    expect(res.status).toBe(401);
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it('rejects invalid processing status', async () => {
    const res = await request(app)
      .post('/api/internal/documents/doc-1/processing-result')
      .set('x-worker-token', WORKER_TOKEN)
      .send({ status: 'pending' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid processing status');
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it('persists a failed job with a processing error', async () => {
    mockedApply.mockResolvedValue({
      id: 'doc-1',
      status: 'failed',
      processingError: 'Gemini timeout',
    });

    const res = await request(app)
      .post('/api/internal/documents/doc-1/processing-result')
      .set('x-worker-token', WORKER_TOKEN)
      .send({ status: 'failed', processingError: 'Gemini timeout' });

    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe('failed');
    expect(res.body.document.processingError).toBe('Gemini timeout');
  });

  it('treats invalid model output as a failed document without 4xx', async () => {
    mockedApply.mockResolvedValue({
      id: 'doc-1',
      status: 'failed',
      processingError: 'invalid_model_output',
      invalidModelOutput: true,
    });

    const res = await request(app)
      .post('/api/internal/documents/doc-1/processing-result')
      .set('x-worker-token', WORKER_TOKEN)
      .send({ status: 'processed', extractedData: { decision: 'nope' } });

    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe('failed');
    expect(res.body.document.processingError).toBe('invalid_model_output');
    expect(mockedApply).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ status: 'processed' }),
    );
  });

  it('accepts a valid processed payload', async () => {
    mockedApply.mockResolvedValue({
      id: 'doc-1',
      status: 'processed',
      processingError: null,
    });

    const res = await request(app)
      .post('/api/internal/documents/doc-1/processing-result')
      .set('x-worker-token', WORKER_TOKEN)
      .send({
        status: 'processed',
        modelId: 'gemini-2.5-flash',
        extractedData: {
          type: 'White Card',
          expiryDate: '2027-03-14',
          licenseNumber: 'WC-1',
          name: 'Jordan Mercer',
          confidence: 0.95,
          content: 'ok',
          pages: [],
          decision: 'clear',
          risk: 'low',
          issueType: null,
          explanation: 'Valid white card',
          evidence: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe('processed');
    expect(mockedApply).toHaveBeenCalledTimes(1);
  });
});
