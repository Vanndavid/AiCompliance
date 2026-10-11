-- Reminders go to the account owner, so a per-worker address is never read.
ALTER TABLE "CrewMember" DROP COLUMN IF EXISTS "email";
