import prisma from '../config/prisma';
import { daysUntilExpiry } from '../utils/dateUtils';
import { collapseDuplicateDocuments } from '../utils/documentDedupe';
import { formatDocumentListItem } from '../utils/documentFormatter';
import { classifyHolder, type HolderKind } from '../utils/holderKind';
import { HttpError } from '../utils/httpError';
import { displayPersonName, normalizePersonName } from '../utils/nameUtils';
import { computeCrewOverview } from '../utils/overviewUtils';
import { comparePersonStatus, EXPIRING_THIS_WEEK_DAYS, personOpsStatus } from '../utils/opsStatus';
import type { ExtractedDocumentData } from '../models/Document';

export const upsertCrewMember = async (
  userId: string,
  projectId: number,
  holderName?: string | null,
) => {
  const name = displayPersonName(holderName);
  const nameNormalized = normalizePersonName(name);

  return prisma.crewMember.upsert({
    where: {
      userId_projectId_nameNormalized: { userId, projectId, nameNormalized },
    },
    update: { name },
    create: { userId, projectId, name, nameNormalized },
  });
};

export const linkDocumentToCrewMember = async (
  documentId: string,
  userId: string,
  projectId: number,
  holderName?: string | null,
) => {
  const crew = await upsertCrewMember(userId, projectId, holderName);
  await prisma.document.update({
    where: { id: documentId },
    data: { crewMemberId: crew.id },
  });
  return crew;
};

const extractionOf = (extraction: unknown): ExtractedDocumentData | undefined =>
  extraction && typeof extraction === 'object' && !Array.isArray(extraction)
    ? (extraction as ExtractedDocumentData)
    : undefined;

export const listCrewForProject = async (
  userId: string,
  projectId: number,
  expiringWithinDays = EXPIRING_THIS_WEEK_DAYS,
) => {
  const [members, docs] = await Promise.all([
    prisma.crewMember.findMany({
      where: { userId, projectId },
      orderBy: { name: 'asc' },
    }),
    prisma.document.findMany({
      where: { userId, projectId },
      orderBy: { uploadDate: 'desc' },
      take: 200,
      include: {
        evaluations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ]);

  const formatted = collapseDuplicateDocuments(docs.map(formatDocumentListItem));

  const membersById = new Map(members.map(member => [member.id, member]));
  const membersByName = new Map(members.map(member => [member.nameNormalized, member]));
  const grouped = new Map<
    string,
    {
      id: string | null;
      name: string;
      kind: HolderKind;
      documents: typeof formatted;
    }
  >();

  for (const doc of formatted) {
    const extraction = extractionOf(doc.extraction);
    const linked = doc.crewMemberId ? membersById.get(doc.crewMemberId) : undefined;
    const holderName = displayPersonName(extraction?.holderName);
    const nameKey = linked?.nameNormalized ?? normalizePersonName(holderName);
    const member = linked ?? membersByName.get(nameKey);
    const kind = classifyHolder({ docType: extraction?.docType, holderName });
    const key = `${kind}:${nameKey}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.documents.push(doc);
      continue;
    }
    grouped.set(key, {
      id: member?.id ?? null,
      name: member?.name ?? holderName,
      kind,
      documents: [doc],
    });
  }

  /** Soonest expiry first, so the document you have to chase is at the top. */
  const byUrgency = (a: (typeof formatted)[number], b: (typeof formatted)[number]) => {
    const aDays = daysUntilExpiry(extractionOf(a.extraction)?.expiryDate) ?? 99999;
    const bDays = daysUntilExpiry(extractionOf(b.extraction)?.expiryDate) ?? 99999;
    return aDays - bDays;
  };

  const crew = [...grouped.values()]
    .map(group => {
      const documents = [...group.documents].sort(byUrgency);
      const soonest = daysUntilExpiry(extractionOf(documents[0]?.extraction)?.expiryDate);
      return {
        id: group.id,
        name: group.name,
        kind: group.kind,
        status: personOpsStatus(documents, expiringWithinDays),
        nextExpiryDate: extractionOf(documents[0]?.extraction)?.expiryDate ?? null,
        daysUntilNextExpiry: soonest ?? null,
        documents,
      };
    })
    .sort(
      (a, b) => comparePersonStatus(a.status, b.status) || a.name.localeCompare(b.name),
    );

  const overview = computeCrewOverview(formatted, expiringWithinDays);

  return { overview, crew };
};

export const getCrewMemberForUser = async (crewMemberId: string, userId: string) => {
  const member = await prisma.crewMember.findFirst({
    where: { id: crewMemberId, userId },
  });
  if (!member) {
    throw new HttpError(404, 'Crew member not found');
  }
  return member;
};
