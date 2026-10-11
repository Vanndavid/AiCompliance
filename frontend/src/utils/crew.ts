import type { CrewMemberItem, DocumentItem, HolderKind, OpsStatus } from '../types';

export const OPS_STATUS_LABEL: Record<OpsStatus, string> = {
  processing: 'Processing',
  failed: 'Failed',
  expired: 'Expired',
  not_compliant: 'Not compliant',
  needs_human: 'Needs your check',
  expiring: 'Expiring',
  valid: 'Valid',
};

export const PERSON_STATUS_LABEL: Record<OpsStatus, string> = {
  processing: 'Processing',
  failed: 'Failed',
  expired: 'Cannot go on site',
  not_compliant: 'Cannot go on site',
  needs_human: 'Needs your check',
  expiring: 'Expiring this week',
  valid: 'All valid',
};

export const STATUS_RANK: OpsStatus[] = [
  'expired',
  'not_compliant',
  'needs_human',
  'expiring',
  'processing',
  'failed',
  'valid',
];

const normalizeName = (name?: string | null) =>
  (name || 'Unassigned').trim().replace(/\s+/g, ' ').toLowerCase() || 'unassigned';

const daysUntil = (date?: string | null) => {
  if (!date) {
    return null;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Math.ceil((parsed.getTime() - Date.now()) / 86400000);
};

/** Used for search results, which come back as a flat list of documents. */
export const groupDocumentsByHolder = (documents: DocumentItem[]): CrewMemberItem[] => {
  const groups = new Map<string, CrewMemberItem>();

  for (const doc of documents) {
    const name = doc.extraction?.holderName?.trim() || 'Unassigned';
    const kind: HolderKind = doc.holderKind ?? 'person';
    const key = `${kind}:${normalizeName(name)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.documents.push(doc);
    } else {
      groups.set(key, {
        id: doc.crewMemberId ?? null,
        name,
        kind,
        status: 'valid',
        documents: [doc],
      });
    }
  }

  return [...groups.values()].map(group => {
    const documents = [...group.documents].sort(
      (a, b) =>
        (daysUntil(a.extraction?.expiryDate) ?? 99999) -
        (daysUntil(b.extraction?.expiryDate) ?? 99999),
    );
    const statuses = documents
      .map(doc => doc.opsStatus)
      .filter((status): status is OpsStatus => Boolean(status));
    return {
      ...group,
      documents,
      status: STATUS_RANK.find(status => statuses.includes(status)) ?? 'valid',
      nextExpiryDate: documents[0]?.extraction?.expiryDate ?? null,
      daysUntilNextExpiry: daysUntil(documents[0]?.extraction?.expiryDate),
    };
  });
};

/** Human-readable urgency line for a holder row, e.g. "Expired 12 days ago". */
export const expiryLine = (holder: CrewMemberItem) => {
  const count = `${holder.documents.length} document${holder.documents.length === 1 ? '' : 's'}`;
  const days = holder.daysUntilNextExpiry;
  if (days == null || !holder.nextExpiryDate) {
    return count;
  }
  if (days < 0) {
    return `${count} · expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  }
  if (days === 0) {
    return `${count} · expires today`;
  }
  return `${count} · next expiry in ${days} day${days === 1 ? '' : 's'}`;
};
