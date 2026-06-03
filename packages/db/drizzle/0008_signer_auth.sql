ALTER TYPE "auth_method" ADD VALUE IF NOT EXISTS 'email_otp';
--> statement-breakpoint
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "auth_passed_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "otp_hash" text;
--> statement-breakpoint
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "otp_expires_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "otp_attempts" integer DEFAULT 0 NOT NULL;
