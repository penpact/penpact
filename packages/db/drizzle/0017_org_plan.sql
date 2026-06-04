ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'free' NOT NULL;
