-- Manual rollback for 20260529120000_add_async_generation_history_fields
-- Run only if you explicitly decide to revert this schema change.
ALTER TABLE "GenerationHistory"
DROP COLUMN IF EXISTS "updatedAt",
DROP COLUMN IF EXISTS "finishedAt",
DROP COLUMN IF EXISTS "startedAt",
DROP COLUMN IF EXISTS "providerId",
DROP COLUMN IF EXISTS "taskType",
DROP COLUMN IF EXISTS "errorMessage";
