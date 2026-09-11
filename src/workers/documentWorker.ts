// this is local worker using BullMQ and Redis, this will be replaced by SQS worker later. see src/workers/sqsWorker.ts

import { Worker } from 'bullmq';
import connection from '../config/redis';
import { DOCUMENT_QUEUE_NAME } from '../queues/documentQueue';
import { analyzeDocument } from '../services/geminiService';
import { applyProcessingResult } from '../services/compliance/applyProcessingResult';
import dotenv from 'dotenv';

dotenv.config();

console.log('Document Worker Started. Waiting for jobs...');

// Define the shape of the Job Data for TypeScript
interface DocumentJobData {
  docId: string;
  filePath: string;
  mimeType: string;
}

export const worker = new Worker<DocumentJobData>(DOCUMENT_QUEUE_NAME, async (job) => {
  console.log(`Processing job ${job.id}: ${job.data.docId}`);

  try {
    // Explicitly destructure with types
    const { docId, filePath, mimeType } = job.data;

    // 1. Analyze with Gemini
    const aiResult = await analyzeDocument(filePath, mimeType);
    console.log(`AI analysis complete for ${docId}`);

    const updatedDoc = await applyProcessingResult(docId, {
      status: 'processed',
      extractedData: aiResult,
    });

    console.log(`Document updated: ${updatedDoc.id}`);
    return aiResult;

  } catch (error) {
    console.error(`Job failed ${job.id}:`, error);
    
    // Mark DB as failed
    if (job.data.docId) {
      await applyProcessingResult(job.data.docId, {
        status: 'failed',
        processingError: error instanceof Error ? error.message : 'processing_failed',
      });
    }
    throw error;
  }
}, { 
  connection: connection as any, // FIX: Cast to any to resolve ioredis version mismatch
  concurrency: 5 
});