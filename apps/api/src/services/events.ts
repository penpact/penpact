import type { ActorType, AuditEventType } from '@penpact/core';
import { type Database, events } from '@penpact/db';

/** A Drizzle client or an in-flight transaction — events are written in the same tx as the state change. */
type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface EventInput {
  envelopeId: string;
  type: AuditEventType;
  actor: ActorType;
  signerId?: string | null;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  geoApprox?: string | null;
  device?: string | null;
  docHashAtEvent?: string | null;
  metadata?: unknown;
}

/** Append one immutable row to the audit trail (§8). Never updated or deleted. */
export async function recordEvent(db: Executor, input: EventInput): Promise<void> {
  await db.insert(events).values({
    envelopeId: input.envelopeId,
    signerId: input.signerId ?? null,
    type: input.type,
    actor: input.actor,
    actorId: input.actorId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    geoApprox: input.geoApprox ?? null,
    device: input.device ?? null,
    docHashAtEvent: input.docHashAtEvent ?? null,
    metadata: input.metadata ?? null,
  });
}
