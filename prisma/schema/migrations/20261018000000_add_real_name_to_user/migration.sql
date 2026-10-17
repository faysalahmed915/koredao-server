-- Add verified real name columns to user table (staff-managed, audited)
-- real_name: optional real identity name used only after moderation verification
-- real_name_updated_at: timestamp when real_name was last set/changed by staff
-- real_name_updated_by: user id of the staff member who last set/changed real_name

ALTER TABLE "user"
  ADD COLUMN "real_name" TEXT,
  ADD COLUMN "real_name_updated_at" TIMESTAMP(3),
  ADD COLUMN "real_name_updated_by" TEXT;
