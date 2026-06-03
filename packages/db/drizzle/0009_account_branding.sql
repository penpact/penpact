ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_color" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand_logo_url" text;
