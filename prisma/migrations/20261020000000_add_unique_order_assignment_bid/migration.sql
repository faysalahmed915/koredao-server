-- Create unique index for bid-acceptance idempotency:
-- one order per (assignmentId, bidId) combination.
--
-- Nullable columns permit multiple NULLs per Postgres unique semantics,
-- so gig orders (null assignmentId / null bidId) are unaffected and can
-- still have many rows.
--
-- This supports the idempotent acceptBid flow: repeated acceptance of the
-- same assignment+bid returns the existing order instead of duplicating it.

CREATE UNIQUE INDEX IF NOT EXISTS "order_assignmentId_bidId_key"
  ON "order"("assignmentId", "bidId");