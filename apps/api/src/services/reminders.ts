/**
 * Automated reminders. Envelopes with `reminderIntervalHours` set get their
 * still-unsigned signers re-nudged every N hours. The claim is atomic
 * (UPDATE ... RETURNING with FOR UPDATE SKIP LOCKED) so horizontally-scaled
 * workers never double-send for the same window.
 */
import { type Database, envelopes, signers } from '@penpact/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { sendSigningInvite } from './email.js';
import { recordEvent } from './events.js';

interface DueEnvelope {
  id: string;
  documentName: string;
}

/** Atomically claim envelopes whose next reminder is due and stamp the time. */
export async function claimDueReminders(
  db: Database,
  now: Date,
  limit: number,
): Promise<DueEnvelope[]> {
  const nowIso = now.toISOString();
  const result = await db.execute(sql`
    UPDATE envelopes
    SET last_reminder_at = ${nowIso}::timestamptz
    WHERE id IN (
      SELECT id FROM envelopes
      WHERE reminder_interval_hours IS NOT NULL
        AND status IN ('sent', 'viewed', 'partially_signed')
        AND sent_at IS NOT NULL
        AND (expires_at IS NULL OR expires_at > ${nowIso}::timestamptz)
        AND COALESCE(last_reminder_at, sent_at)
            + make_interval(hours => reminder_interval_hours) <= ${nowIso}::timestamptz
      ORDER BY id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id AS "id", document_name AS "documentName"
  `);
  return (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as DueEnvelope[];
}

export interface ReminderDeps {
  now?: Date;
  limit?: number;
  baseUrl?: string;
}

/**
 * Send one round of due reminders. Returns the number of signer emails sent.
 * Email delivery is best-effort (no-op when email is unconfigured); the audit
 * event + claim still record that a reminder was attempted.
 */
export async function processReminders(db: Database, deps: ReminderDeps = {}): Promise<number> {
  const now = deps.now ?? new Date();
  const limit = deps.limit ?? 100;
  const base = deps.baseUrl ?? process.env.PUBLIC_BASE_URL ?? '';

  const due = await claimDueReminders(db, now, limit);
  if (due.length === 0) {
    return 0;
  }

  let reminded = 0;
  for (const env of due) {
    // Only signers who were invited but have not finished can be reminded.
    const recipients = await db
      .select({
        id: signers.id,
        name: signers.name,
        email: signers.email,
        token: signers.signingToken,
      })
      .from(signers)
      .where(and(eq(signers.envelopeId, env.id), inArray(signers.status, ['sent', 'viewed'])));

    for (const r of recipients) {
      await sendSigningInvite({
        to: r.email,
        signerName: r.name,
        documentName: env.documentName,
        signUrl: `${base}/sign/${r.token}`,
      });
      await recordEvent(db, {
        envelopeId: env.id,
        signerId: r.id,
        type: 'email_sent',
        actor: 'system',
        metadata: { reminder: true },
      });
      reminded++;
    }
  }
  return reminded;
}

/** Convenience for callers that already have an envelope id (e.g. tests). */
export async function isReminderEnabled(db: Database, envelopeId: string): Promise<boolean> {
  const rows = await db
    .select({ h: envelopes.reminderIntervalHours })
    .from(envelopes)
    .where(eq(envelopes.id, envelopeId))
    .limit(1);
  return rows[0]?.h != null;
}
