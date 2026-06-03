ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
ALTER TABLE "envelopes" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'live' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_status" integer DEFAULT 0 NOT NULL,
  "response_body" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_user_key_uq" ON "idempotency_keys" ("user_id", "idempotency_key");
