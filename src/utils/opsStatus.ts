import { daysUntilExpiry } from './dateUtils';

export const EXPIRING_THIS_WEEK_DAYS = 7;
export const ALERT_WINDOW_DAYS = 30;

export type OpsStatus = 'processing' | 'failed' | 'needs_human' | 'expired' | 'expiring' | 'valid';

export const OPS_STATUS_LABEL: Record<OpsStatus, string> = {
  processing: 'Processing',
  failed: 'Failed',
  needs_human: 'Needs a human',
  expired: 'Expired',
  expiring: 'Expiring',
  valid: 'Valid',
};

const PERSON_STATUS_PRIORITY: OpsStatus[] = [
  'expired',
  'needs_human',
  'expiring',
  'processing',
  'failed',
  'valid',
];

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

  if (doc.evaluation?.reviewStatus === 'pending') {
    return 'needs_human';
  }

  if (effectiveDecision(doc.evaluation) === 'flagged') {
    return 'needs_human';
  }

  const days = daysUntilExpiry(expiryDateOf(doc.extraction));
  if (days != null && days < 0) {
    return 'expired';
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

export const opsStatusLabel = (status: OpsStatus) => OPS_STATUS_LABEL[status];
