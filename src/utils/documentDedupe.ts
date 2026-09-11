import { normalizePersonName } from './nameUtils';

export type DedupeDocumentInput = {
  id: string;
  name: string;
  status: string;
  contentHash?: string | null;
  extraction?: unknown;
};

const extractionFields = (extraction: unknown) => {
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return { holderName: '', licenseNumber: '', expiryDate: '' };
  }
  const record = extraction as Record<string, unknown>;
  return {
    holderName: typeof record.holderName === 'string' ? record.holderName : '',
    licenseNumber: typeof record.licenseNumber === 'string' ? record.licenseNumber : '',
    expiryDate: typeof record.expiryDate === 'string' ? record.expiryDate : '',
  };
};

const STATUS_RANK: Record<string, number> = {
  processed: 3,
  pending: 2,
  uploading: 1,
  failed: 0,
};

const dedupeKey = (doc: DedupeDocumentInput) => {
  if (doc.contentHash) {
    return `hash:${doc.contentHash}`;
  }

  const fields = extractionFields(doc.extraction);
  const name = doc.name.trim().toLowerCase();
  const holder = normalizePersonName(fields.holderName);
  const license = fields.licenseNumber.trim().toLowerCase();
  return `meta:${name}|${holder}|${license}|${fields.expiryDate}`;
};

const isBetterDuplicate = (candidate: DedupeDocumentInput, current: DedupeDocumentInput) => {
  const candidateRank = STATUS_RANK[candidate.status] ?? -1;
  const currentRank = STATUS_RANK[current.status] ?? -1;
  return candidateRank > currentRank;
};

/** Keep one row per identical file / extracted identity. Input should be newest-first. */
export const collapseDuplicateDocuments = <T extends DedupeDocumentInput>(docs: T[]): T[] => {
  const kept = new Map<string, T>();

  for (const doc of docs) {
    const key = dedupeKey(doc);
    const existing = kept.get(key);
    if (!existing || isBetterDuplicate(doc, existing)) {
      kept.set(key, doc);
    }
  }

  return docs.filter(doc => kept.get(dedupeKey(doc))?.id === doc.id);
};
