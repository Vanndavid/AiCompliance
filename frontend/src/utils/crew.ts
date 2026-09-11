import type { CrewMemberItem, DocumentItem, OpsStatus } from '../types';

export const OPS_STATUS_LABEL: Record<OpsStatus, string> = {
  processing: 'Processing',
  failed: 'Failed',
  needs_human: 'Needs a human',
  expired: 'Expired',
  expiring: 'Expiring',
  valid: 'Valid',
};

export const PERSON_STATUS_LABEL: Record<OpsStatus, string> = {
  processing: 'Processing',
  failed: 'Failed',
  needs_human: 'Needs a human',
  expired: 'Cannot go on site',
  expiring: 'Expiring this week',
  valid: 'Site-ready',
};

const normalizeName = (name?: string | null) =>
  (name || 'Unassigned').trim().replace(/\s+/g, ' ').toLowerCase() || 'unassigned';

export const groupDocumentsByHolder = (documents: DocumentItem[]): CrewMemberItem[] => {
  const groups = new Map<string, CrewMemberItem>();

  for (const doc of documents) {
    const name = doc.extraction?.holderName?.trim() || 'Unassigned';
    const key = normalizeName(name);
    const existing = groups.get(key);
    if (existing) {
      existing.documents.push(doc);
    } else {
      groups.set(key, {
        id: doc.crewMemberId ?? null,
        name,
        email: null,
        status: 'valid',
        documents: [doc],
      });
    }
  }

  const rank: OpsStatus[] = ['expired', 'needs_human', 'expiring', 'processing', 'failed', 'valid'];
  return [...groups.values()].map(group => {
    const statuses = group.documents.map(doc => doc.opsStatus).filter((status): status is OpsStatus => Boolean(status));
    return {
      ...group,
      status: rank.find(status => statuses.includes(status)) ?? 'valid',
    };
  });
};
