import prisma from '../config/prisma';
import { sendCrewReminder } from './reminderService';
import type { ExtractedDocumentData } from '../models/Document';
import { daysUntilExpiry } from '../utils/dateUtils';
import { collapseDuplicateDocuments } from '../utils/documentDedupe';
import { displayPersonName, normalizePersonName } from '../utils/nameUtils';
import { ALERT_WINDOW_DAYS, documentOpsStatus } from '../utils/opsStatus';

export type FormattedNotification = {
  id: string;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: string;
  crewMemberId: string | null;
  crewMemberName: string | null;
  documentId: string;
  expiryDate: string | null;
  docType: string | null;
  nextAction: 'remind';
  emailSentAt: string | null;
};

export const formatNotification = (notification: {
  id: number;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: Date;
  crewMemberId: string | null;
  documentId: string;
  emailSentAt: Date | null;
  crewMember?: { name: string } | null;
  document?: { extractedData: unknown; originalName: string };
}): FormattedNotification => {
  const extracted = notification.document?.extractedData as ExtractedDocumentData | null;
  return {
    id: String(notification.id),
    type: notification.type,
    message: notification.message,
    createdAt: notification.createdAt.toISOString(),
    crewMemberId: notification.crewMemberId,
    crewMemberName: notification.crewMember?.name || extracted?.holderName || null,
    documentId: notification.documentId,
    expiryDate: extracted?.expiryDate ?? null,
    docType: extracted?.docType || notification.document?.originalName || null,
    nextAction: 'remind',
    emailSentAt: notification.emailSentAt ? notification.emailSentAt.toISOString() : null,
  };
};

export const getUnreadNotifications = async (userId: string, projectId?: number) => {
  const alerts = await prisma.notification.findMany({
    where: {
      userId,
      read: false,
      ...(projectId != null ? { document: { projectId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      crewMember: { select: { name: true } },
      document: { select: { extractedData: true, originalName: true } },
    },
  });

  const unique = new Map<string, (typeof alerts)[number]>();
  for (const alert of alerts) {
    const extracted = alert.document.extractedData as ExtractedDocumentData | null;
    const key = alert.crewMemberId || normalizePersonName(extracted?.holderName);
    if (!unique.has(key)) {
      unique.set(key, alert);
    }
  }

  return [...unique.values()].map(formatNotification);
};

export const markNotificationRead = async (id: string, userId: string) => {
  const notificationId = Number(id);

  if (!Number.isInteger(notificationId)) {
    throw new Error('Invalid notification id');
  }

  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error('Notification not found');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
};

type AlertCandidate = {
  documentId: string;
  userId: string;
  projectId: number;
  crewMemberId: string | null;
  holderName: string;
  docType: string;
  expiryDate: string;
  daysUntilExpiry: number;
  userEmail: string;
  userName: string;
  crewMemberEmail: string | null;
};

const buildAlertMessage = (candidate: AlertCandidate) => {
  const when =
    candidate.daysUntilExpiry < 0
      ? `expired on ${candidate.expiryDate}`
      : `expires on ${candidate.expiryDate}`;
  return `${candidate.holderName}: ${candidate.docType} ${when}`;
};

export const scanExpiringDocuments = async (alertWindowDays = ALERT_WINDOW_DAYS) => {
  const docs = await prisma.document.findMany({
    where: { status: 'processed' },
    include: {
      user: { select: { email: true, name: true } },
      crewMember: { select: { id: true, name: true, email: true } },
    },
  });

  const collapsed = collapseDuplicateDocuments(
    docs.map(doc => {
      const extracted = doc.extractedData as ExtractedDocumentData | null;
      return {
        id: doc.id,
        name: doc.originalName,
        status: doc.status,
        contentHash: doc.contentHash,
        extraction: extracted,
        raw: doc,
      };
    }),
  );

  const byPerson = new Map<string, AlertCandidate>();

  for (const item of collapsed) {
    const doc = item.raw;
    const extracted = item.extraction;
    const expiryDate = extracted?.expiryDate;
    const days = daysUntilExpiry(expiryDate);
    if (!expiryDate || days == null) {
      continue;
    }
    if (days > alertWindowDays) {
      continue;
    }

    const ops = documentOpsStatus({
      status: doc.status,
      extraction: extracted,
    });
    if (ops !== 'expired' && ops !== 'expiring' && !(days >= 0 && days <= alertWindowDays)) {
      continue;
    }

    const holderName = doc.crewMember?.name || displayPersonName(extracted?.holderName);
    const personKey = `${doc.userId}:${doc.projectId}:${doc.crewMemberId || normalizePersonName(holderName)}`;
    const candidate: AlertCandidate = {
      documentId: doc.id,
      userId: doc.userId,
      projectId: doc.projectId,
      crewMemberId: doc.crewMemberId,
      holderName,
      docType: extracted?.docType || doc.originalName,
      expiryDate,
      daysUntilExpiry: days,
      userEmail: doc.user.email,
      userName: doc.user.name,
      crewMemberEmail: doc.crewMember?.email ?? null,
    };

    const existing = byPerson.get(personKey);
    if (!existing || candidate.daysUntilExpiry < existing.daysUntilExpiry) {
      byPerson.set(personKey, candidate);
    }
  }

  let created = 0;
  for (const candidate of byPerson.values()) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId: candidate.userId,
        type: 'EXPIRY_WARNING',
        ...(candidate.crewMemberId
          ? { crewMemberId: candidate.crewMemberId }
          : { documentId: candidate.documentId }),
      },
    });

    if (exists) {
      continue;
    }

    const createdAlert = await prisma.notification.create({
      data: {
        type: 'EXPIRY_WARNING',
        message: buildAlertMessage(candidate),
        documentId: candidate.documentId,
        userId: candidate.userId,
        crewMemberId: candidate.crewMemberId,
      },
    });

    try {
      await sendCrewReminder({
        userId: candidate.userId,
        userEmail: candidate.userEmail,
        userName: candidate.userName,
        crewMemberId: candidate.crewMemberId,
        crewMemberName: candidate.holderName,
        crewMemberEmail: candidate.crewMemberEmail,
        documentId: candidate.documentId,
        docType: candidate.docType,
        expiryDate: candidate.expiryDate,
      });
      await prisma.notification.update({
        where: { id: createdAlert.id },
        data: { emailSentAt: new Date() },
      });
    } catch (error) {
      console.error(`Failed to send expiry reminder for ${candidate.documentId}:`, error);
    }

    created += 1;
  }

  return created;
};
