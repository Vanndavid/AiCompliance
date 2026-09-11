import { randomUUID } from 'crypto';
import { addDocumentJob } from '../queues/sqsProducer';
import prisma from '../config/prisma';
import { createSignedUploadUrl, deleteObject } from './storageService';
import { buildDocumentSearchSummary, extractExpiryWindowDays, tokenizeSearchTerms } from '../utils/searchUtils';
import { daysUntilExpiry } from '../utils/dateUtils';
import { sanitizeFileName } from '../utils/fileUtils';
import { formatDocumentListItem } from '../utils/documentFormatter';
import { collapseDuplicateDocuments } from '../utils/documentDedupe';
import { computeCrewOverview } from '../utils/overviewUtils';
import { EXPIRING_THIS_WEEK_DAYS } from '../utils/opsStatus';
import { enforceGeminiQueuePolicy, enforceUploadIntentPolicy } from './usagePolicyService';
import type { Document } from '@prisma/client';
import type { ExtractedDocumentData } from '../models/Document';
import { HttpError } from '../utils/httpError';
import { getProjectForUser } from './projectService';

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const MAX_OVERVIEW_RECORDS = 500;
const MAX_DOCUMENT_LIST_RECORDS = 200;

const assertProjectAccess = async (userId: string, projectId: number) => {
  const project = await getProjectForUser(userId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

export type UploadedFileData = {
  originalname: string;
  key: string;
  mimetype: string;
};

export const createPendingDocumentRecord = async (
  fileData: UploadedFileData,
  userId: string,
  projectId: number,
) => {
  await assertProjectAccess(userId, projectId);
  await enforceGeminiQueuePolicy(userId);

  const newDoc = await prisma.document.create({
    data: {
      originalName: fileData.originalname,
      storagePath: fileData.key,
      mimeType: fileData.mimetype,
      status: 'pending',
      userId,
      projectId,
    },
  });

  if (typeof addDocumentJob === 'function') {
    await addDocumentJob(newDoc.id as unknown as string, newDoc.storagePath, newDoc.mimeType);
  }

  return newDoc;
};

export const createUploadIntent = async (
  userId: string,
  projectId: number,
  fileName: string,
  mimeType: string,
) => {
  await assertProjectAccess(userId, projectId);
  await enforceUploadIntentPolicy(userId);

  const documentId = randomUUID();
  const safeFileName = sanitizeFileName(fileName);
  const key = `uploads/${userId}/${documentId}-${safeFileName}`;

  await prisma.document.create({
    data: {
      id: documentId,
      originalName: fileName,
      storagePath: key,
      mimeType,
      status: 'uploading',
      userId,
      projectId,
    },
  });

  const uploadUrl = await createSignedUploadUrl(
    key,
    mimeType,
    {
      documentId,
      userId,
      originalName: safeFileName,
    },
    UPLOAD_URL_EXPIRY_SECONDS,
  );

  return {
    documentId,
    key,
    uploadUrl,
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  };
};

export const findDuplicateDocument = async (
  userId: string,
  projectId: number,
  contentHash: string,
  excludeId?: string,
) => {
  return prisma.document.findFirst({
    where: {
      userId,
      projectId,
      contentHash,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      status: { in: ['pending', 'processed'] },
    },
    orderBy: { uploadDate: 'desc' },
  });
};

export const markDocumentPendingAndQueue = async (
  document: Document,
  extras?: { contentHash?: string | null; byteSize?: number | null },
) => {
  await enforceGeminiQueuePolicy(document.userId);

  const updatedDoc = await prisma.document.update({
    where: { id: document.id },
    data: {
      status: 'pending',
      ...(extras?.contentHash ? { contentHash: extras.contentHash } : {}),
      ...(extras?.byteSize != null ? { byteSize: extras.byteSize } : {}),
    },
  });

  if (typeof addDocumentJob === 'function') {
    await addDocumentJob(updatedDoc.id as unknown as string, updatedDoc.storagePath, updatedDoc.mimeType);
  }

  return updatedDoc;
};

export const getAllDocuments = async (userId: string, projectId?: number) => {
  const docs = await prisma.document.findMany({
    where: {
      userId,
      ...(projectId != null ? { projectId } : {}),
    },
    orderBy: { uploadDate: 'desc' },
    take: MAX_DOCUMENT_LIST_RECORDS,
    include: {
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return collapseDuplicateDocuments(docs.map(formatDocumentListItem));
};

export const getDocumentStatusById = async (id: string, userId: string) => {
  return prisma.document.findFirst({
    where: { id, userId },
    include: {
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
};

export const deleteDocumentForUser = async (documentId: string, userId: string) => {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, storagePath: true },
  });

  if (!doc) {
    throw new HttpError(404, 'Document not found');
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { documentId: doc.id } }),
    prisma.document.delete({ where: { id: doc.id } }),
  ]);

  try {
    await deleteObject(doc.storagePath);
  } catch (error) {
    console.error(
      `Deleted document ${doc.id} from the database but failed to remove S3 object ${doc.storagePath}:`,
      error,
    );
  }

  return { id: doc.id };
};

export const getDocumentOverview = async (
  userId: string,
  projectId: number | undefined,
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
) => {
  const docs = await prisma.document.findMany({
    where: {
      userId,
      ...(projectId != null ? { projectId } : {}),
    },
    select: {
      id: true,
      originalName: true,
      status: true,
      extractedData: true,
      contentHash: true,
    },
    orderBy: { uploadDate: 'desc' },
    take: MAX_OVERVIEW_RECORDS,
  });

  const mapped = docs.map(doc => {
    const extracted = doc.extractedData as ExtractedDocumentData | null;
    return {
      id: doc.id,
      name: doc.originalName,
      originalName: doc.originalName,
      status: doc.status,
      contentHash: doc.contentHash,
      extraction: {
        expiryDate: extracted?.expiryDate,
        holderName: extracted?.holderName,
        licenseNumber: extracted?.licenseNumber,
      },
    };
  });

  return computeCrewOverview(mapped, expiringWithinDays);
};

export const searchProcessedDocuments = async (
  userId: string,
  query: string,
  projectId?: number,
) => {
  const keywordTerms = tokenizeSearchTerms(query);
  const expiryWindowDays = extractExpiryWindowDays(query);

  const docs = await prisma.document.findMany({
    where: {
      userId,
      status: 'processed',
      ...(projectId != null ? { projectId } : {}),
    },
    orderBy: { uploadDate: 'desc' },
    take: 100,
    include: {
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const results = docs
    .map(doc => {
      const haystack = buildDocumentSearchSummary(doc);
      const matchedTerms = keywordTerms.filter(term => haystack.includes(term));
      const expiryInDays = daysUntilExpiry((doc.extractedData as ExtractedDocumentData | null)?.expiryDate);
      const matchesExpiryWindow = expiryWindowDays == null
        ? true
        : expiryInDays != null && expiryInDays >= 0 && expiryInDays <= expiryWindowDays;

      const keywordMatchRequired = keywordTerms.length === 0 || matchedTerms.length > 0;
      if (!keywordMatchRequired || !matchesExpiryWindow) {
        return null;
      }

      const reasons: string[] = [];
      if (matchedTerms.length > 0) {
        reasons.push(`Matched ${matchedTerms.join(', ')}`);
      }
      if (expiryWindowDays != null && expiryInDays != null) {
        reasons.push(`Expires in ${expiryInDays} day${expiryInDays === 1 ? '' : 's'}`);
      }

      return {
        ...formatDocumentListItem(doc),
        matchReasons: reasons,
        score: matchedTerms.length + (matchesExpiryWindow && expiryWindowDays != null ? 2 : 0),
      };
    })
    .filter(doc => doc !== null);

  const collapsed = collapseDuplicateDocuments(results);

  return {
    query,
    interpretedFilters: {
      keywords: keywordTerms,
      expiryWithinDays: expiryWindowDays,
    },
    results: collapsed
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...doc }) => doc),
  };
};


