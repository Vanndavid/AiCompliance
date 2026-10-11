import { daysUntilExpiry } from './dateUtils';

export const EXPIRING_THIS_WEEK_DAYS = 7;
export const ALERT_WINDOW_DAYS = 30;

export type OpsStatus =
  | 'processing'
  | 'failed'
  | 'expired'
  | 'not_compliant'
  | 'needs_human'
  | 'expiring'
  | 'valid';

/** Worst-first. A person inherits the worst status across their documents. */
const PERSON_STATUS_PRIORITY: OpsStatus[] = [
  'expired',
  'not_compliant',
  'needs_human',
  'expiring',
  'processing',
  'failed',
  'valid',
];

/** Statuses that stop someone walking through the gate. */
export const BLOCKING_STATUSES: OpsStatus[] = ['expired', 'not_compliant'];

export type OpsStatusInput = {
  status: string;
  extraction?: unknown;
  evaluation?: {
    reviewStatus?: string | null;
    finalDecision?: string | null;
    overrideDecision?: string | null;
  } | null;
};

const expiryDateOf = (extraction: unknown) => {
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return undefined;
  }
  const value = (extraction as { expiryDate?: unknown }).expiryDate;
  return typeof value === 'string' ? value : undefined;
};

const effectiveDecision = (evaluation: OpsStatusInput['evaluation']) => {
  if (evaluation?.reviewStatus === 'rejected' && evaluation.overrideDecision) {
    return evaluation.overrideDecision;
  }
  return evaluation?.finalDecision ?? null;
};

/**
 * The expiry date is checked before the review state on purpose. An expired
 * document is a fact the reviewer cannot change, and reading "Needs a human" on
 * one expired licence and "Expired" on another made the list untrustworthy.
 * Once a reviewer has acted, the document never reports "Needs a human" again.
 */
export const documentOpsStatus = (
  doc: OpsStatusInput,
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
): OpsStatus => {
  if (doc.status === 'pending' || doc.status === 'uploading') {
    return 'processing';
  }
  if (doc.status === 'failed') {
    return 'failed';
  }

  const days = daysUntilExpiry(expiryDateOf(doc.extraction));
  if (days != null && days < 0) {
    return 'expired';
  }

  if (doc.evaluation?.reviewStatus === 'pending') {
    return 'needs_human';
  }

  if (effectiveDecision(doc.evaluation) === 'flagged') {
    return 'not_compliant';
  }

  if (days != null && days <= expiringWithinDays) {
    return 'expiring';
  }

  return 'valid';
};

export const personOpsStatus = (
  documents: OpsStatusInput[],
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
): OpsStatus => {
  if (documents.length === 0) {
    return 'needs_human';
  }

  const statuses = documents.map(doc => documentOpsStatus(doc, expiringWithinDays));
  return PERSON_STATUS_PRIORITY.find(status => statuses.includes(status)) ?? 'valid';
};

export const comparePersonStatus = (a: OpsStatus, b: OpsStatus) =>
  PERSON_STATUS_PRIORITY.indexOf(a) - PERSON_STATUS_PRIORITY.indexOf(b);
