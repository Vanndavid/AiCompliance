import request from 'supertest';
import app from '../server';
import { bearerAuthHeader } from './helpers/auth';

jest.mock('../services/documentService', () => ({
  createUploadIntent: jest.fn(),
  deleteDocumentForUser: jest.fn(),
}));

import { createUploadIntent, deleteDocumentForUser } from '../services/documentService';
import { HttpError } from '../utils/httpError';

const mockedCreateUploadIntent =
  createUploadIntent as jest.MockedFunction<typeof createUploadIntent>;
const mockedDeleteDocument =
  deleteDocumentForUser as jest.MockedFunction<typeof deleteDocumentForUser>;

describe('POST /api/documents/upload-url', () => {
  it('returns upload url for valid request', async () => {
    mockedCreateUploadIntent.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      key: 'uploads/test_user_123/doc-1-file.pdf',
      uploadUrl: 'https://example.com/upload',
      expiresIn: 300,
    });

    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        projectId: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.documentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(res.body.uploadUrl).toBeDefined();
    expect(mockedCreateUploadIntent).toHaveBeenCalledWith(
      'test_user_123',
      1,
      'file.pdf',
      'application/pdf',
    );
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

    expect(res.status).toBe(401);
  });

  it('rejects upload without projectId', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('projectId is required');
  });

  it('rejects unsupported file type', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.exe',
        mimeType: 'application/x-msdownload',
        projectId: 1,
      });

    expect(res.status).toBe(400);
  });

  it('returns 500 when service fails', async () => {
    mockedCreateUploadIntent.mockRejectedValue(
      new Error('service failure')
    );

    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        projectId: 1,
      });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/documents/:id', () => {
  beforeEach(() => {
    mockedDeleteDocument.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).delete('/api/documents/doc-1');
    expect(res.status).toBe(401);
    expect(mockedDeleteDocument).not.toHaveBeenCalled();
  });

  it('deletes a document owned by the user', async () => {
    mockedDeleteDocument.mockResolvedValue({ id: 'doc-1' });

    const res = await request(app).delete('/api/documents/doc-1').set(bearerAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockedDeleteDocument).toHaveBeenCalledWith('doc-1', 'test_user_123');
  });

  it('returns 404 when the document is missing', async () => {
    mockedDeleteDocument.mockRejectedValue(new HttpError(404, 'Document not found'));

    const res = await request(app).delete('/api/documents/missing').set(bearerAuthHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Document not found');
  });
});
