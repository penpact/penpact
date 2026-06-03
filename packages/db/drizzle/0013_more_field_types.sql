ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'dropdown';
--> statement-breakpoint
ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'radio';
--> statement-breakpoint
ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'stamp';
--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN IF NOT EXISTS "options" jsonb;
--> statement-breakpoint
ALTER TABLE "template_fields" ADD COLUMN IF NOT EXISTS "options" jsonb;
