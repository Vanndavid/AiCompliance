import { daysUntilExpiry } from './dateUtils';
import { collapseDuplicateDocuments, type DedupeDocumentInput } from './documentDedupe';
import { displayPersonName, normalizePersonName } from './nameUtils';
import {
  EXPIRING_THIS_WEEK_DAYS,
  personOpsStatus,
  type OpsStatus,
  type OpsStatusInput,
} from './opsStatus';

export type OverviewDocument = DedupeDocumentInput & OpsStatusInput & {
  originalName?: string;
};

export type CrewOverviewTotals = {
  expired: number;
  expiringSoon: number;
  siteReady: number;
  needsHuman: number;
  processing: number;
  failed: number;
  people: number;
  documents: number;
};

const fieldOf = (extraction: unknown, key: 'holderName' | 'expiryDate' | 'licenseNumber') => {
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return undefined;
  }
  const value = (extraction as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

const soonestExpiry = (docs: OverviewDocument[]) => {
  let best: { expiryDate: string; days: number } | null = null;
  for (const doc of docs) {
    const expiryDate = fieldOf(doc.extraction, 'expiryDate');
    const days = daysUntilExpiry(expiryDate);
    if (expiryDate && days != null && (best == null || days < best.days)) {
      best = { expiryDate, days };
    }
  }
  return best;
};

export const groupDocumentsByHolder = (docs: OverviewDocument[]) => {
  const groups = new Map<string, { name: string; documents: OverviewDocument[] }>();

  for (const doc of docs) {
    const name = displayPersonName(fieldOf(doc.extraction, 'holderName'));
    const key = normalizePersonName(name);
    const existing = groups.get(key);
    if (existing) {
      existing.documents.push(doc);
    } else {
      groups.set(key, { name, documents: [doc] });
    }
  }

  return [...groups.values()];
};

export const computeCrewOverview = (
  docs: OverviewDocument[],
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
) => {
  const uniqueDocs = collapseDuplicateDocuments(docs);
  const people = groupDocumentsByHolder(uniqueDocs).map(group => {
    const status = personOpsStatus(group.documents, expiringWithinDays);
    const expiry = soonestExpiry(group.documents);
    const person: {
      name: string;
      status: OpsStatus;
      daysUntilExpiry: number | null;
      soonestExpiryDate?: string;
    } = {
      name: group.name,
      status,
      daysUntilExpiry: expiry?.days ?? null,
    };
    if (expiry?.expiryDate) {
      person.soonestExpiryDate = expiry.expiryDate;
    }
    return person;
  });

  const totals: CrewOverviewTotals = {
    expired: 0,
    expiringSoon: 0,
    siteReady: 0,
    needsHuman: 0,
    processing: 0,
    failed: 0,
    people: people.length,
    documents: uniqueDocs.length,
  };

  for (const person of people) {
    if (person.status === 'expired') totals.expired += 1;
    else if (person.status === 'expiring') totals.expiringSoon += 1;
    else if (person.status === 'valid') totals.siteReady += 1;
    else if (person.status === 'needs_human') totals.needsHuman += 1;
    else if (person.status === 'processing') totals.processing += 1;
    else if (person.status === 'failed') totals.failed += 1;
  }

  const atRisk = people
    .filter(person => person.status === 'expired' || person.status === 'expiring')
    .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));

  return {
    generatedAt: new Date().toISOString(),
    filters: { expiringWithinDays },
    totals,
    atRisk,
  };
};

/** @deprecated Prefer computeCrewOverview. Kept for callers that still count files. */
export const computeDocumentOverview = (
  docs: Array<{ id: string; originalName: string; status: string; extractedData: any }>,
  expiringWithinDays: number,
  limit: number,
) => {
  const mapped: OverviewDocument[] = docs.map(doc => ({
    id: doc.id,
    name: doc.originalName,
    originalName: doc.originalName,
    status: doc.status,
    extraction: {
      expiryDate: doc.extractedData?.expiryDate,
      holderName: doc.extractedData?.holderName,
      licenseNumber: doc.extractedData?.licenseNumber,
    },
  }));

  const overview = computeCrewOverview(mapped, expiringWithinDays);
  return {
    ...overview,
    expiringDocuments: overview.atRisk.slice(0, limit).map(person => ({
      name: person.name,
      expiryDate: person.soonestExpiryDate,
      daysUntilExpiry: person.daysUntilExpiry,
      status: person.status,
    })),
  };
};
