ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'attachment';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"signer_id" uuid,
	"field_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "envelopes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_envelope_idx" ON "attachments" ("envelope_id");
