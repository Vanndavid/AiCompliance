import prisma from '../config/prisma';
import { collapseDuplicateDocuments } from '../utils/documentDedupe';
import { formatDocumentListItem } from '../utils/documentFormatter';
import { HttpError } from '../utils/httpError';
import { displayPersonName, normalizePersonName } from '../utils/nameUtils';
import { computeCrewOverview } from '../utils/overviewUtils';
import { EXPIRING_THIS_WEEK_DAYS, personOpsStatus } from '../utils/opsStatus';
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
      email: string | null;
      documents: typeof formatted;
    }
  >();

  const ensureGroup = (
    key: string,
    name: string,
    id: string | null,
    email: string | null,
  ) => {
    const existing = grouped.get(key);
    if (existing) {
      return existing;
    }
    const created = { id, name, email, documents: [] as typeof formatted };
    grouped.set(key, created);
    return created;
  };

  for (const doc of formatted) {
    const linked = doc.crewMemberId ? membersById.get(doc.crewMemberId) : undefined;
    const holderName = displayPersonName(
      doc.extraction && typeof doc.extraction === 'object' && !Array.isArray(doc.extraction)
        ? (doc.extraction as ExtractedDocumentData).holderName
        : undefined,
    );
    const nameKey = linked?.nameNormalized ?? normalizePersonName(holderName);
    const member = linked ?? membersByName.get(nameKey);
    const group = ensureGroup(
      nameKey,
      member?.name ?? holderName,
      member?.id ?? null,
      member?.email ?? null,
    );
    group.documents.push(doc);
  }

  const crew = [...grouped.values()]
    .map(group => ({
      id: group.id,
      name: group.name,
      email: group.email,
      status: personOpsStatus(group.documents, expiringWithinDays),
      documents: group.documents,
    }))
    .sort((a, b) => {
      const rank = ['expired', 'needs_human', 'expiring', 'processing', 'failed', 'valid'];
      return rank.indexOf(a.status) - rank.indexOf(b.status) || a.name.localeCompare(b.name);
    });

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

export const updateCrewMemberEmail = async (
  crewMemberId: string,
  userId: string,
  email: string | null,
) => {
  await getCrewMemberForUser(crewMemberId, userId);
  const trimmed = email?.trim() || null;
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new HttpError(400, 'Invalid email address');
  }

  return prisma.crewMember.update({
    where: { id: crewMemberId },
    data: { email: trimmed },
  });
};
