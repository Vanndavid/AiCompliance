jest.mock('../config/prisma', () => ({
  __esModule: true,
  default: {
    document: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../services/ragIngestService', () => ({
  getStoredPages: jest.fn(() => [{ pageNumber: 1, text: 'Expiry Date: 2027-03-14' }]),
  ingestDocumentChunks: jest.fn(async () => ({ documentId: 'doc-1', chunksCreated: 1, pagesIndexed: 1 })),
}));

import prisma from '../config/prisma';
import { ingestDocumentChunks } from '../services/ragIngestService';
import { applyProcessingResult, INVALID_MODEL_OUTPUT } from '../services/compliance/applyProcessingResult';

const mockedUpdate = (prisma.document.update as jest.Mock);
const mockedIngest = ingestDocumentChunks as jest.MockedFunction<typeof ingestDocumentChunks>;

const validPayload = {
  type: 'White Card',
  expiryDate: '2027-03-14',
  issueDate: '2023-03-14',
  licenseNumber: 'WC-4471-2290',
  name: 'Jordan Mercer',
  confidence: 0.95,
  content: 'Construction induction',
  pages: [{ page: 1, text: 'Expiry Date: 2027-03-14' }],
  decision: 'clear',
  risk: 'low',
  issueType: null,
  explanation: 'All fields present and unexpired.',
  evidence: [{ quote: 'Expiry Date: 2027-03-14', page: 1 }],
};

describe('applyProcessingResult', () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
    mockedIngest.mockClear();
  });

  it('marks the document failed when the model JSON is invalid', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedUpdate.mockResolvedValue({
      id: 'doc-1',
      status: 'failed',
      processingError: `${INVALID_MODEL_OUTPUT}: Model output is not valid JSON`,
    });

    try {
      const result = await applyProcessingResult('doc-1', {
        status: 'processed',
        extractedData: '{ not json',
      });

      expect(result.status).toBe('failed');
      expect(result.processingError).toBe(
        `${INVALID_MODEL_OUTPUT}: Model output is not valid JSON`,
      );
      expect(result.invalidModelOutput).toBe(true);
      expect(mockedIngest).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid model output for document doc-1'),
        expect.objectContaining({ kind: 'string' }),
      );
      expect(mockedUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            processingError: `${INVALID_MODEL_OUTPUT}: Model output is not valid JSON`,
          }),
        }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('processes sparse Gemini JSON by defaulting missing evaluation fields', async () => {
    mockedUpdate.mockResolvedValue({
      id: 'doc-1',
      status: 'processed',
      processingError: null,
      extractedData: { pages: [], content: 'Tower crane lift SWMS' },
    });

    const result = await applyProcessingResult('doc-1', {
      status: 'processed',
      modelId: 'gemini-2.5-flash',
      extractedData: {
        type: 'SWMS',
        content: 'Tower crane lift SWMS',
      },
    });

    expect(result.status).toBe('processed');
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'processed',
          evaluations: expect.objectContaining({
            create: expect.objectContaining({
              llmDecision: 'uncertain',
              risk: 'medium',
              confidence: 0.5,
              explanation: 'Tower crane lift SWMS',
              needsReview: true,
            }),
          }),
        }),
      }),
    );
  });

  it('persists extraction, evaluation, and indexes chunks for valid output', async () => {
    mockedUpdate.mockResolvedValue({
      id: 'doc-1',
      status: 'processed',
      processingError: null,
      extractedData: { pages: validPayload.pages },
    });

    const result = await applyProcessingResult('doc-1', {
      status: 'processed',
      modelId: 'gemini-2.5-flash',
      extractedData: validPayload,
    });

    expect(result.status).toBe('processed');
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'processed',
          evaluations: expect.objectContaining({
            create: expect.objectContaining({
              modelId: 'gemini-2.5-flash',
              promptVersion: 'compliance-eval-v2',
              llmDecision: 'clear',
              reviewStatus: 'not_required',
              finalDecision: 'clear',
            }),
          }),
        }),
      }),
    );
    expect(mockedIngest).toHaveBeenCalled();
  });

  it('stores processingError for worker-reported failures', async () => {
    mockedUpdate.mockResolvedValue({
      id: 'doc-1',
      status: 'failed',
      processingError: 'S3 timeout',
    });

    const result = await applyProcessingResult('doc-1', {
      status: 'failed',
      processingError: 'S3 timeout',
    });

    expect(result.processingError).toBe('S3 timeout');
    expect(mockedIngest).not.toHaveBeenCalled();
  });
});
