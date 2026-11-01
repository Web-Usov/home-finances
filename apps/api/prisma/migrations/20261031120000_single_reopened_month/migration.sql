-- MON-13 defence in depth: at most one month may be 'reopened'. Partial unique index on the status
-- column; only rows with status = 'reopened' are indexed, so any number of other months is allowed.
-- Not modelled in schema.prisma (Prisma cannot express partial indexes). IF NOT EXISTS keeps a re-run
-- harmless; existing data satisfies the index because the lock-based check (T-036) already allows one.
CREATE UNIQUE INDEX IF NOT EXISTS "budget_month_single_reopened_key"
  ON "budget_month" ("status")
  WHERE "status" = 'reopened';
