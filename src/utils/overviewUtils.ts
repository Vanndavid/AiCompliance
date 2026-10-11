import { daysUntilExpiry } from './dateUtils';
import { collapseDuplicateDocuments, type DedupeDocumentInput } from './documentDedupe';
import { classifyHolder, type HolderKind } from './holderKind';
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
  blocked: number;
  expired: number;
  notCompliant: number;
  expiringSoon: number;
  allValid: number;
  needsHuman: number;
  processing: number;
  failed: number;
  people: number;
  organisations: number;
  documents: number;
};

const fieldOf = (
  extraction: unknown,
  key: 'holderName' | 'expiryDate' | 'licenseNumber' | 'docType',
) => {
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

export type HolderGroup = {
  name: string;
  kind: HolderKind;
  documents: OverviewDocument[];
};

export const groupDocumentsByHolder = (docs: OverviewDocument[]): HolderGroup[] => {
  const groups = new Map<string, HolderGroup>();

  for (const doc of docs) {
    const name = displayPersonName(fieldOf(doc.extraction, 'holderName'));
    const kind = classifyHolder({
      docType: fieldOf(doc.extraction, 'docType'),
      holderName: name,
    });
    const key = `${kind}:${normalizePersonName(name)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.documents.push(doc);
    } else {
      groups.set(key, { name, kind, documents: [doc] });
    }
  }

  return [...groups.values()];
};

export const computeCrewOverview = (
  docs: OverviewDocument[],
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
) => {
  const uniqueDocs = collapseDuplicateDocuments(docs);
  const holders = groupDocumentsByHolder(uniqueDocs).map(group => {
    const status = personOpsStatus(group.documents, expiringWithinDays);
    const expiry = soonestExpiry(group.documents);
    const holder: {
      name: string;
      kind: HolderKind;
      status: OpsStatus;
      daysUntilExpiry: number | null;
      soonestExpiryDate?: string;
    } = {
      name: group.name,
      kind: group.kind,
      status,
      daysUntilExpiry: expiry?.days ?? null,
    };
    if (expiry?.expiryDate) {
      holder.soonestExpiryDate = expiry.expiryDate;
    }
    return holder;
  });

  const totals: CrewOverviewTotals = {
    blocked: 0,
    expired: 0,
    notCompliant: 0,
    expiringSoon: 0,
    allValid: 0,
    needsHuman: 0,
    processing: 0,
    failed: 0,
    people: holders.filter(holder => holder.kind === 'person').length,
    organisations: holders.filter(holder => holder.kind === 'organisation').length,
    documents: uniqueDocs.length,
  };

  for (const holder of holders) {
    if (holder.status === 'expired') totals.expired += 1;
    else if (holder.status === 'not_compliant') totals.notCompliant += 1;
    else if (holder.status === 'expiring') totals.expiringSoon += 1;
    else if (holder.status === 'valid') totals.allValid += 1;
    else if (holder.status === 'needs_human') totals.needsHuman += 1;
    else if (holder.status === 'processing') totals.processing += 1;
    else if (holder.status === 'failed') totals.failed += 1;
  }
  totals.blocked = totals.expired + totals.notCompliant;

  const atRisk = holders
    .filter(holder => holder.status === 'expired' || holder.status === 'expiring')
    .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));

  return {
    generatedAt: new Date().toISOString(),
    filters: { expiringWithinDays },
    totals,
    atRisk,
  };
};
