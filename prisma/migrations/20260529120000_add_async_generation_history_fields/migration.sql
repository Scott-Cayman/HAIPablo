-- Safe migration for existing GenerationHistory rows:
-- 1. add nullable columns first
-- 2. add updatedAt with a temporary default
-- 3. backfill any existing rows
-- 4. enforce NOT NULL after data is valid
ALTER TABLE "GenerationHistory"
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "taskType" TEXT,
ADD COLUMN "providerId" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "GenerationHistory"
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "GenerationHistory"
ALTER COLUMN "updatedAt" SET NOT NULL;
