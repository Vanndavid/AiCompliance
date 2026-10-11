import prisma from '../config/prisma';
import { buildMailtoUrl, sendEmail } from './emailService';
import { HttpError } from '../utils/httpError';
import type { ExtractedDocumentData } from '../models/Document';

/**
 * Reminders always go to the account owner. They are the person who chases the
 * renewal, and asking them to keep a second address per worker up to date is
 * more admin than the reminder saves.
 */
type ReminderTarget = {
  userId: string;
  userEmail: string;
  userName: string;
  crewMemberId?: string | null;
  crewMemberName: string;
  documentId?: string | null;
  docType?: string | null;
  expiryDate?: string | null;
};

const reminderCopy = (target: ReminderTarget) => {
  const document = target.docType || 'compliance document';
  const expiry = target.expiryDate ? ` on ${target.expiryDate}` : '';
  const subject = `${target.crewMemberName}: ${document} expires${expiry || ' soon'}`;
  const text = [
    `Hi ${target.userName || 'there'},`,
    '',
    `${target.crewMemberName} cannot go on site unless this is renewed.`,
    `Document: ${document}`,
    target.expiryDate ? `Expiry: ${target.expiryDate}` : null,
    '',
    'Please remind them today.',
  ]
    .filter(line => line !== null)
    .join('\n');

  return { subject, text };
};

export const sendCrewReminder = async (target: ReminderTarget) => {
  const to = (target.userEmail || '').trim();
  if (!to) {
    throw new HttpError(400, 'No email address is available to send a reminder');
  }

  const { subject, text } = reminderCopy(target);
  const result = await sendEmail({ to, subject, text });

  await prisma.reminder.create({
    data: {
      userId: target.userId,
      crewMemberId: target.crewMemberId ?? null,
      documentId: target.documentId ?? null,
      toEmail: to,
      subject,
      body: text,
      channel: result.channel,
    },
  });

  return {
    ...result,
    subject,
    mailto: buildMailtoUrl({ to, subject, text }),
  };
};

export const sendReminderForNotification = async (notificationId: number, userId: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    include: {
      user: { select: { email: true, name: true } },
      document: { select: { id: true, extractedData: true, originalName: true } },
      crewMember: { select: { id: true, name: true } },
    },
  });

  if (!notification) {
    throw new HttpError(404, 'Alert not found');
  }

  const extracted = notification.document.extractedData as ExtractedDocumentData | null;
  const result = await sendCrewReminder({
    userId,
    userEmail: notification.user.email,
    userName: notification.user.name,
    crewMemberId: notification.crewMemberId,
    crewMemberName: notification.crewMember?.name || extracted?.holderName || 'Unassigned',
    documentId: notification.documentId,
    docType: extracted?.docType || notification.document.originalName,
    expiryDate: extracted?.expiryDate ?? null,
  });

  await prisma.notification.update({
    where: { id: notification.id },
    data: { emailSentAt: new Date() },
  });

  return result;
};

export const sendReminderForCrewMember = async (
  crewMemberId: string,
  userId: string,
  documentId?: string,
) => {
  const member = await prisma.crewMember.findFirst({
    where: { id: crewMemberId, userId },
    include: {
      user: { select: { email: true, name: true } },
      documents: documentId
        ? { where: { id: documentId }, orderBy: { uploadDate: 'desc' as const }, take: 1 }
        : { orderBy: { uploadDate: 'desc' as const }, take: 1 },
    },
  });

  if (!member) {
    throw new HttpError(404, 'Crew member not found');
  }

  const document = member.documents[0];
  const extracted = document?.extractedData as ExtractedDocumentData | null;

  return sendCrewReminder({
    userId,
    userEmail: member.user.email,
    userName: member.user.name,
    crewMemberId: member.id,
    crewMemberName: member.name,
    documentId: document?.id ?? null,
    docType: extracted?.docType || document?.originalName || null,
    expiryDate: extracted?.expiryDate ?? null,
  });
};
