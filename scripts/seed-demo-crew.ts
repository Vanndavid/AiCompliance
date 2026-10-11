/**
 * Throwaway local check: fills the demo project with a spread of holders and
 * review states so the dashboard can be eyeballed. Run with `--clean` to undo.
 */
import prisma from '../src/config/prisma';

const SEED_TAG = 'seed-demo-crew';

const fixtures = [
  {
    originalName: 'White Card Jordan Mercer.pdf',
    docType: 'White Card',
    holderName: 'Jordan Mercer',
    expiryDate: '2029-04-18',
    licenseNumber: 'WC-88213',
    review: 'none' as const,
  },
  {
    originalName: 'High Risk Work Licence Amara Nguyen.pdf',
    docType: 'High Risk Work Licence',
    holderName: 'Amara Nguyen',
    expiryDate: '2026-09-15',
    licenseNumber: 'HRW-40192',
    review: 'pending' as const,
  },
  {
    originalName: 'White Card Priya Raman.pdf',
    docType: 'White Card',
    holderName: 'Priya Raman',
    expiryDate: '2026-02-10',
    licenseNumber: 'WC-55110',
    review: 'pending' as const,
  },
  {
    originalName: 'Statement of Attainment Tom Ellis.pdf',
    docType: 'Statement of Attainment',
    holderName: 'Tom Ellis',
    expiryDate: '2027-11-02',
    licenseNumber: 'SOA-2201',
    review: 'approved' as const,
  },
  {
    originalName: 'Public Liability Certificate Northside Civil.pdf',
    docType: 'Certificate of Currency',
    holderName: 'Northside Civil Contracting Pty Ltd',
    expiryDate: '2026-09-30',
    licenseNumber: 'POL-771020',
    review: 'none' as const,
  },
  {
    originalName: 'SWMS Tower Crane Lift Operations.pdf',
    docType: 'SWMS',
    holderName: 'Northside Civil Contracting Pty Ltd',
    expiryDate: '2026-06-01',
    licenseNumber: null,
    review: 'rejected_clear' as const,
  },
];

const main = async () => {
  const user = await prisma.user.findFirst({ where: { email: { contains: 'demo' } } });
  if (!user) {
    throw new Error('No demo user found');
  }
  const project = await prisma.project.findFirst({ where: { userId: user.id } });
  if (!project) {
    throw new Error('No project found for demo user');
  }

  if (process.argv.includes('--clean')) {
    const docs = await prisma.document.findMany({
      where: { userId: user.id, projectId: project.id, storagePath: { contains: SEED_TAG } },
      select: { id: true },
    });
    const ids = docs.map(doc => doc.id);
    await prisma.notification.deleteMany({ where: { documentId: { in: ids } } });
    await prisma.reminder.deleteMany({ where: { documentId: { in: ids } } });
    await prisma.document.deleteMany({ where: { id: { in: ids } } });
    await prisma.crewMember.deleteMany({ where: { userId: user.id, projectId: project.id } });
    console.log(`Removed ${ids.length} seeded documents`);
    return;
  }

  for (const fixture of fixtures) {
    const crew = await prisma.crewMember.upsert({
      where: {
        userId_projectId_nameNormalized: {
          userId: user.id,
          projectId: project.id,
          nameNormalized: fixture.holderName.toLowerCase(),
        },
      },
      update: {},
      create: {
        userId: user.id,
        projectId: project.id,
        name: fixture.holderName,
        nameNormalized: fixture.holderName.toLowerCase(),
      },
    });

    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        projectId: project.id,
        crewMemberId: crew.id,
        originalName: fixture.originalName,
        storagePath: `${SEED_TAG}/${fixture.originalName}`,
        mimeType: 'application/pdf',
        status: 'processed',
        contentHash: `${SEED_TAG}-${fixture.originalName}`,
        extractedData: {
          docType: fixture.docType,
          holderName: fixture.holderName,
          expiryDate: fixture.expiryDate,
          licenseNumber: fixture.licenseNumber,
          confidence: 0.92,
          content: 'Sample extracted text.',
        },
      },
    });

    if (fixture.review === 'none') {
      await prisma.documentEvaluation.create({
        data: {
          documentId: doc.id,
          modelId: 'seed',
          promptVersion: 'v1',
          llmDecision: 'clear',
          risk: 'low',
          confidence: 0.93,
          explanation: 'All required fields present.',
          evidence: [],
          ruleHits: [],
          finalDecision: 'clear',
          needsReview: false,
          routingReason: 'High-confidence, low-risk clear result with no rule hits',
          reviewStatus: 'not_required',
        },
      });
      continue;
    }

    const reviewed = fixture.review !== 'pending';
    await prisma.documentEvaluation.create({
      data: {
        documentId: doc.id,
        modelId: 'seed',
        promptVersion: 'v1',
        llmDecision: 'uncertain',
        risk: 'medium',
        confidence: 0.44,
        issueType: fixture.review === 'approved' ? 'EXPIRED_DOCUMENT' : 'UNCLEAR_SCAN',
        explanation: 'The model could not read the expiry field with confidence.',
        evidence: [],
        ruleHits: [],
        finalDecision: 'flagged',
        needsReview: true,
        routingReason: 'Model was uncertain (44% extraction confidence)',
        reviewStatus:
          fixture.review === 'pending'
            ? 'pending'
            : fixture.review === 'approved'
              ? 'approved'
              : 'rejected',
        ...(reviewed
          ? {
              reviewerId: user.id,
              reviewedAt: new Date(),
              ...(fixture.review === 'rejected_clear' ? { overrideDecision: 'clear' as const } : {}),
            }
          : {}),
      },
    });
  }

  console.log(`Seeded ${fixtures.length} documents into project ${project.name}`);
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
