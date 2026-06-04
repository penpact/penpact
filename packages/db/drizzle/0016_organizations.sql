CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_created_by_idx" ON "organizations" ("created_by");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_members_org_user_uq" ON "organization_members" ("organization_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_members_user_idx" ON "organization_members" ("user_id");
--> statement-breakpoint
ALTER TABLE "envelopes" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "active_org_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL;
--> statement-breakpoint
-- Backfill: one personal organization per existing user, owned by them.
INSERT INTO "organizations" ("name", "created_by")
  SELECT coalesce(nullif(trim("name"), ''), split_part("email", '@', 1)) || '''s workspace', "id"
  FROM "users"
  WHERE NOT EXISTS (SELECT 1 FROM "organizations" o WHERE o."created_by" = "users"."id");
--> statement-breakpoint
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
  SELECT o."id", o."created_by", 'owner'
  FROM "organizations" o
  WHERE o."created_by" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "organization_members" m
      WHERE m."organization_id" = o."id" AND m."user_id" = o."created_by"
    );
--> statement-breakpoint
UPDATE "envelopes" e SET "organization_id" = o."id"
  FROM "organizations" o WHERE o."created_by" = e."user_id" AND e."organization_id" IS NULL;
--> statement-breakpoint
UPDATE "templates" t SET "organization_id" = o."id"
  FROM "organizations" o WHERE o."created_by" = t."user_id" AND t."organization_id" IS NULL;
--> statement-breakpoint
UPDATE "api_keys" k SET "organization_id" = o."id"
  FROM "organizations" o WHERE o."created_by" = k."user_id" AND k."organization_id" IS NULL;
--> statement-breakpoint
UPDATE "webhook_endpoints" w SET "organization_id" = o."id"
  FROM "organizations" o WHERE o."created_by" = w."user_id" AND w."organization_id" IS NULL;
