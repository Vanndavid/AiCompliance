import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { getStoredPages, ingestDocumentChunks } from '../ragIngestService';
import { evaluateParsedLlm } from './evaluateParsedLlm';
import { EVALUATION_PROMPT_VERSION, getGeminiModelId } from './extractionPrompt';
import { parseLlmEvaluation } from './parseLlmEvaluation';
import { InvalidLlmOutputError } from './types';
import { upsertCrewMember } from '../crewService';

export const INVALID_MODEL_OUTPUT = 'invalid_model_output';

export type ProcessingResultPayload = {
  status: string;
  extractedData?: unknown | undefined;
  modelId?: string | undefined;
  processingError?: string | undefined;
};

export type AppliedProcessingResult = {
  id: string;
  status: string;
  processingError: string | null;
  invalidModelOutput?: boolean;
};

const markFailed = async (documentId: string, processingError: string) => {
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'failed',
      processingError,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    processingError: updated.processingError,
  };
};

/**
 * Single write path for Lambda callbacks and Node workers. Validates model
 * JSON, runs deterministic rules, routes to CLEAR or review, then persists.
 */
export const applyProcessingResult = async (
  documentId: string,
  payload: ProcessingResultPayload,
): Promise<AppliedProcessingResult> => {
  if (payload.status === 'failed') {
    return markFailed(documentId, payload.processingError || 'processing_failed');
  }

  if (payload.status !== 'processed') {
    throw new Error('Invalid processing status');
  }

  let parsed;
  try {
    parsed = parseLlmEvaluation(payload.extractedData);
  } catch (error) {
    if (error instanceof InvalidLlmOutputError) {
      const extracted = payload.extractedData;
      const preview =
        typeof extracted === 'object' && extracted !== null && !Array.isArray(extracted)
          ? {
              decision: (extracted as Record<string, unknown>).decision,
              risk: (extracted as Record<string, unknown>).risk,
              confidence: (extracted as Record<string, unknown>).confidence,
            }
          : { kind: typeof extracted };
      console.error(
        `Invalid model output for document ${documentId}: ${error.message}`,
        preview,
      );
      const failed = await markFailed(
        documentId,
        `${INVALID_MODEL_OUTPUT}: ${error.message}`,
      );
      return { ...failed, invalidModelOutput: true };
    }
    throw error;
  }

  const { ruleHits, routing } = evaluateParsedLlm(parsed);
  const modelId = payload.modelId || getGeminiModelId();

  const current = await prisma.document.findUnique({
    where: { id: documentId },
    select: { userId: true, projectId: true },
  });

  let crewMemberId: string | undefined;
  if (current?.userId && current.projectId != null) {
    const crew = await upsertCrewMember(
      current.userId,
      current.projectId,
      parsed.extraction.holderName,
    );
    crewMemberId = crew.id;
  }

  const updatedDoc = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'processed',
      processingError: null,
      extractedData: parsed.extraction as Prisma.InputJsonValue,
      ...(crewMemberId ? { crewMemberId } : {}),
      evaluations: {
        create: {
          modelId,
          promptVersion: EVALUATION_PROMPT_VERSION,
          llmDecision: parsed.llmDecision,
          risk: parsed.risk,
          confidence: parsed.confidence,
          issueType: parsed.issueType,
          explanation: parsed.explanation,
          evidence: parsed.evidence as Prisma.InputJsonValue,
          ruleHits: ruleHits as Prisma.InputJsonValue,
          finalDecision: routing.finalDecision,
          needsReview: routing.needsReview,
          routingReason: routing.routingReason,
          reviewStatus: routing.reviewStatus,
        },
      },
    },
  });

  try {
    const pages = getStoredPages(updatedDoc.extractedData);
    const result = await ingestDocumentChunks(updatedDoc.id, pages);
    console.log(`Indexed ${result.chunksCreated} chunks for document ${updatedDoc.id}`);
  } catch (indexError) {
    console.error(`Failed to index document ${updatedDoc.id} for retrieval:`, indexError);
  }

  return {
    id: updatedDoc.id,
    status: updatedDoc.status,
    processingError: updatedDoc.processingError,
  };
};
