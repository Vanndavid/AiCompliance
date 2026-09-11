-- Observable processing failures (invalid model output, Gemini/S3 errors).
ALTER TABLE "Document" ADD COLUMN "processingError" TEXT;

-- CreateEnum
CREATE TYPE "LlmDecision" AS ENUM ('clear', 'flagged', 'uncertain');
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "ComplianceDecision" AS ENUM ('clear', 'flagged');
CREATE TYPE "ReviewStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "DocumentEvaluation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "llmDecision" "LlmDecision" NOT NULL,
    "risk" "RiskLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "issueType" TEXT,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "ruleHits" JSONB NOT NULL,
    "finalDecision" "ComplianceDecision" NOT NULL,
    "needsReview" BOOLEAN NOT NULL,
    "routingReason" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "overrideDecision" "ComplianceDecision",

    CONSTRAINT "DocumentEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentEvaluation_documentId_createdAt_idx" ON "DocumentEvaluation"("documentId", "createdAt");
CREATE INDEX "DocumentEvaluation_reviewStatus_idx" ON "DocumentEvaluation"("reviewStatus");

ALTER TABLE "DocumentEvaluation" ADD CONSTRAINT "DocumentEvaluation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentEvaluation" ADD CONSTRAINT "DocumentEvaluation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
