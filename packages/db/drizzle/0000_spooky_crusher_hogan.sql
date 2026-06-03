CREATE TYPE "public"."actor_type" AS ENUM('sender', 'signer', 'system');--> statement-breakpoint
CREATE TYPE "public"."audit_event_type" AS ENUM('envelope_created', 'email_sent', 'document_viewed', 'consent_disclosure_shown', 'consent_accepted', 'authentication_passed', 'field_completed', 'signed', 'declined', 'completed', 'copy_delivered', 'voided');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('email_link', 'access_code', 'sms_otp', 'id_verification');--> statement-breakpoint
CREATE TYPE "public"."envelope_status" AS ENUM('draft', 'sent', 'viewed', 'partially_signed', 'completed', 'declined', 'voided', 'expired');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox');--> statement-breakpoint
CREATE TYPE "public"."signature_type" AS ENUM('drawn', 'typed', 'adopted', 'uploaded');--> statement-breakpoint
CREATE TYPE "public"."signer_status" AS ENUM('pending', 'sent', 'viewed', 'signed', 'declined');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"storage_key" text,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"byte_size" integer,
	"is_final" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_version_chk" CHECK ("documents"."version" >= 1),
	CONSTRAINT "documents_bytesize_chk" CHECK ("documents"."byte_size" is null or "documents"."byte_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_name" text NOT NULL,
	"status" "envelope_status" DEFAULT 'draft' NOT NULL,
	"document_hash_original" text,
	"document_hash_final" text,
	"hash_algorithm" text DEFAULT 'SHA-256' NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"disclosure_version" text,
	"disclosure_hash" text,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"signer_id" uuid,
	"type" "audit_event_type" NOT NULL,
	"actor" "actor_type" NOT NULL,
	"actor_id" text,
	"ip_address" text,
	"user_agent" text,
	"geo_approx" text,
	"device" text,
	"doc_hash_at_event" text,
	"metadata" jsonb,
	"timestamp_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_id" uuid,
	"type" "field_type" NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"width" double precision NOT NULL,
	"height" double precision NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"value" text,
	"ai_detected" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fields_geometry_chk" CHECK ("fields"."page" >= 1 and "fields"."x" >= 0 and "fields"."y" >= 0 and "fields"."width" > 0 and "fields"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"routing_order" integer DEFAULT 1 NOT NULL,
	"auth_method" "auth_method" DEFAULT 'email_link' NOT NULL,
	"access_code_hash" text,
	"signing_token" text NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_timestamp" timestamp with time zone,
	"consent_disclosure_hash" text,
	"signature_type" "signature_type",
	"ip_address" text,
	"geo_approx" text,
	"user_agent" text,
	"device" text,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signers_routing_order_chk" CHECK ("signers"."routing_order" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_signer_id_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_signer_id_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."signers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signers" ADD CONSTRAINT "signers_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_envelope_uq" ON "certificates" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "documents_envelope_idx" ON "documents" USING btree ("envelope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_final_uq" ON "documents" USING btree ("envelope_id") WHERE "documents"."is_final";--> statement-breakpoint
CREATE INDEX "envelopes_user_status_idx" ON "envelopes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "events_envelope_time_idx" ON "events" USING btree ("envelope_id","timestamp_utc");--> statement-breakpoint
CREATE INDEX "fields_envelope_idx" ON "fields" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "fields_signer_idx" ON "fields" USING btree ("signer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signers_token_uq" ON "signers" USING btree ("signing_token");--> statement-breakpoint
CREATE INDEX "signers_envelope_order_idx" ON "signers" USING btree ("envelope_id","routing_order");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));