ALTER TABLE "envelopes" ADD COLUMN IF NOT EXISTS "reminder_interval_hours" integer;
--> statement-breakpoint
ALTER TABLE "envelopes" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamptz;
