ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "public_slug" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "templates_public_slug_uq" ON "templates" ("public_slug");
