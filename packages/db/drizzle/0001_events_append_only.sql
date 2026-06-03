-- Custom SQL migration file, put your code below! --

-- Enforce that the audit trail is APPEND-ONLY at the database level.
-- The legal value of the signing evidence depends on it being tamper-evident,
-- so UPDATE and DELETE on `events` are rejected even by application bugs.

CREATE OR REPLACE FUNCTION penpact_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER events_no_update
  BEFORE UPDATE ON "events"
  FOR EACH ROW EXECUTE FUNCTION penpact_events_immutable();
--> statement-breakpoint
CREATE TRIGGER events_no_delete
  BEFORE DELETE ON "events"
  FOR EACH ROW EXECUTE FUNCTION penpact_events_immutable();
