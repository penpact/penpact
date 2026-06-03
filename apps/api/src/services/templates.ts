/**
 * Reusable document templates. A template captures a PDF, signer roles, and
 * field placements. Instantiation copies the template's document into a fresh
 * draft envelope and maps each role to a real signer, so the normal send /
 * sign / seal / certificate flow is unchanged.
 */

import { randomUUID } from 'node:crypto';
import {
  type Database,
  documents,
  envelopes,
  fields,
  signers,
  templateFields,
  templateRoles,
  templates,
  users,
} from '@penpact/db';
import { and, desc, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { generateSigningToken, sha256HexBytes } from '../lib/crypto.js';
import { HttpProblem } from '../lib/problem.js';
import type {
  InstantiateInput,
  PlaceTemplateFieldsInput,
  TemplateCreateInput,
} from '../schemas.js';
import type { Storage } from '../storage/index.js';
import {
  type EnvelopeResponse,
  getEnvelope,
  type RequestContext,
  sendEnvelope,
} from './envelopes.js';
import { recordEvent } from './events.js';

type FieldType = (typeof templateFields.$inferSelect)['type'];

export interface TemplateRoleResponse {
  id: string;
  name: string;
  routingOrder: number;
}
export interface TemplateFieldResponse {
  id: string;
  roleId: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
}
export interface TemplateResponse {
  id: string;
  name: string;
  documentName: string;
  storageKey: string | null;
  pageCount: number | null;
  roles: TemplateRoleResponse[];
  fields: TemplateFieldResponse[];
  createdAt: string;
}

async function requireTemplate(db: Database, userId: string, id: string) {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, userId)))
    .limit(1);
  const tpl = rows[0];
  if (!tpl) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Template not found.' });
  }
  return tpl;
}

export async function createTemplate(
  db: Database,
  userId: string,
  input: TemplateCreateInput,
): Promise<TemplateResponse> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(templates)
      .values({ userId, name: input.name, documentName: input.documentName })
      .returning();
    const tpl = inserted[0];
    if (!tpl) throw new Error('Failed to create template');
    const roleRows = await tx
      .insert(templateRoles)
      .values(
        input.roles.map((r, i) => ({
          templateId: tpl.id,
          name: r.name,
          routingOrder: r.routingOrder ?? i + 1,
        })),
      )
      .returning();
    return toResponse(tpl, roleRows, []);
  });
}

function toResponse(
  tpl: typeof templates.$inferSelect,
  roleRows: (typeof templateRoles.$inferSelect)[],
  fieldRows: (typeof templateFields.$inferSelect)[],
): TemplateResponse {
  return {
    id: tpl.id,
    name: tpl.name,
    documentName: tpl.documentName,
    storageKey: tpl.storageKey,
    pageCount: tpl.pageCount,
    roles: roleRows
      .slice()
      .sort((a, b) => a.routingOrder - b.routingOrder)
      .map((r) => ({ id: r.id, name: r.name, routingOrder: r.routingOrder })),
    fields: fieldRows.map((f) => ({
      id: f.id,
      roleId: f.roleId,
      type: f.type,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
    })),
    createdAt: tpl.createdAt.toISOString(),
  };
}

export async function listTemplates(db: Database, userId: string): Promise<TemplateResponse[]> {
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .orderBy(desc(templates.createdAt));
  return Promise.all(rows.map((t) => load(db, t)));
}

export async function getTemplate(
  db: Database,
  userId: string,
  id: string,
): Promise<TemplateResponse | null> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, userId)))
    .limit(1);
  const tpl = rows[0];
  return tpl ? load(db, tpl) : null;
}

async function load(db: Database, tpl: typeof templates.$inferSelect): Promise<TemplateResponse> {
  const [roleRows, fieldRows] = await Promise.all([
    db.select().from(templateRoles).where(eq(templateRoles.templateId, tpl.id)),
    db.select().from(templateFields).where(eq(templateFields.templateId, tpl.id)),
  ]);
  return toResponse(tpl, roleRows, fieldRows);
}

export async function deleteTemplate(db: Database, userId: string, id: string): Promise<void> {
  await db.delete(templates).where(and(eq(templates.id, id), eq(templates.userId, userId)));
}

export async function uploadTemplateDocument(
  db: Database,
  storage: Storage,
  userId: string,
  id: string,
  bytes: Uint8Array,
): Promise<TemplateResponse> {
  await requireTemplate(db, userId, id);
  let pageCount: number;
  try {
    pageCount = (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new HttpProblem({ status: 422, title: 'Validation Error', detail: 'Not a valid PDF.' });
  }
  const storageKey = `templates/${id}/source.pdf`;
  await storage.put(storageKey, bytes, 'application/pdf');
  await db
    .update(templates)
    .set({ storageKey, contentHash: sha256HexBytes(bytes), pageCount, byteSize: bytes.byteLength })
    .where(eq(templates.id, id));
  const updated = await getTemplate(db, userId, id);
  if (!updated) throw new Error('Template vanished after upload');
  return updated;
}

export async function placeTemplateFields(
  db: Database,
  userId: string,
  id: string,
  input: PlaceTemplateFieldsInput,
): Promise<TemplateFieldResponse[]> {
  const tpl = await requireTemplate(db, userId, id);
  const roleRows = await db
    .select({ id: templateRoles.id })
    .from(templateRoles)
    .where(eq(templateRoles.templateId, id));
  const roleIds = new Set(roleRows.map((r) => r.id));
  for (const f of input.fields) {
    if (!roleIds.has(f.roleId)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: 'A field references a role that is not part of this template.',
      });
    }
    if (tpl.pageCount && (f.page < 1 || f.page > tpl.pageCount)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `Field page ${f.page} is out of range (1..${tpl.pageCount}).`,
      });
    }
  }
  const inserted = await db
    .insert(templateFields)
    .values(
      input.fields.map((f) => ({
        templateId: id,
        roleId: f.roleId,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required ?? true,
      })),
    )
    .returning();
  return inserted.map((f) => ({
    id: f.id,
    roleId: f.roleId,
    type: f.type,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    required: f.required,
  }));
}

export async function instantiateTemplate(
  db: Database,
  storage: Storage,
  userId: string,
  id: string,
  input: InstantiateInput,
): Promise<EnvelopeResponse> {
  const tpl = await requireTemplate(db, userId, id);
  if (!tpl.storageKey) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document to the template before instantiating it.',
    });
  }
  const [roleRows, fieldRows, userRows] = await Promise.all([
    db.select().from(templateRoles).where(eq(templateRoles.templateId, id)),
    db.select().from(templateFields).where(eq(templateFields.templateId, id)),
    db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);
  const user = userRows[0];
  if (!user) throw new Error('Authenticated user not found');

  // Every role must be mapped to exactly one signer.
  const mapping = new Map(input.signers.map((s) => [s.roleId, s]));
  for (const role of roleRows) {
    if (!mapping.has(role.id)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `No signer provided for role "${role.name}".`,
      });
    }
  }

  // Copy the template document bytes into the new envelope's own object.
  const bytes = await storage.get(tpl.storageKey);

  return db.transaction(async (tx) => {
    const env = (
      await tx
        .insert(envelopes)
        .values({
          userId,
          documentName: input.documentName ?? tpl.documentName,
          senderName: user.name ?? user.email,
          senderEmail: user.email,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .returning()
    )[0];
    if (!env) throw new Error('Failed to create envelope');

    const signerByRole = new Map<string, string>();
    for (const role of roleRows) {
      const s = mapping.get(role.id);
      if (!s) continue;
      const signer = (
        await tx
          .insert(signers)
          .values({
            envelopeId: env.id,
            name: s.name,
            email: s.email,
            routingOrder: role.routingOrder,
            signingToken: generateSigningToken(),
          })
          .returning()
      )[0];
      if (signer) signerByRole.set(role.id, signer.id);
    }

    const storageKey = `envelopes/${env.id}/source.pdf`;
    await storage.put(storageKey, bytes, 'application/pdf');
    const doc = (
      await tx
        .insert(documents)
        .values({
          envelopeId: env.id,
          storageKey,
          contentHash: tpl.contentHash ?? sha256HexBytes(bytes),
          pageCount: tpl.pageCount,
          byteSize: tpl.byteSize,
          isFinal: false,
        })
        .returning()
    )[0];
    if (!doc) throw new Error('Failed to copy document');

    if (fieldRows.length > 0) {
      await tx.insert(fields).values(
        fieldRows.map((f) => ({
          envelopeId: env.id,
          documentId: doc.id,
          signerId: signerByRole.get(f.roleId) ?? null,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          required: f.required,
        })),
      );
    }

    await recordEvent(tx, {
      envelopeId: env.id,
      type: 'envelope_created',
      actor: 'sender',
      actorId: userId,
      metadata: { fromTemplate: id },
    });

    const result = await getEnvelope(tx as unknown as Database, userId, env.id);
    if (!result) throw new Error('Envelope vanished after instantiation');
    return result;
  });
}

// ─── public (evergreen) signing links ───

/** Turn a single-role template into a public, self-serve signing link. */
export async function publishTemplate(
  db: Database,
  userId: string,
  id: string,
): Promise<{ slug: string }> {
  const tpl = await requireTemplate(db, userId, id);
  if (!tpl.storageKey) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document to the template before publishing it.',
    });
  }
  const roleRows = await db
    .select({ id: templateRoles.id })
    .from(templateRoles)
    .where(eq(templateRoles.templateId, id));
  if (roleRows.length !== 1) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Public links require a template with exactly one signer role.',
    });
  }
  const slug = tpl.publicSlug ?? randomUUID().replace(/-/g, '').slice(0, 12);
  await db.update(templates).set({ isPublic: true, publicSlug: slug }).where(eq(templates.id, id));
  return { slug };
}

export async function unpublishTemplate(db: Database, userId: string, id: string): Promise<void> {
  await requireTemplate(db, userId, id);
  await db.update(templates).set({ isPublic: false }).where(eq(templates.id, id));
}

/** Public template metadata for the self-serve landing page (no auth). */
export async function getPublicTemplate(
  db: Database,
  slug: string,
): Promise<{ name: string; documentName: string } | null> {
  const rows = await db
    .select({ name: templates.name, documentName: templates.documentName })
    .from(templates)
    .where(and(eq(templates.publicSlug, slug), eq(templates.isPublic, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Spin up a fresh envelope from a public template for a self-identified signer,
 * send it, and return their signing token. No API key required — the template's
 * owner account is the sender.
 */
export async function startPublicSigning(
  db: Database,
  storage: Storage,
  slug: string,
  signer: { name: string; email: string },
  ctx: RequestContext,
): Promise<{ token: string }> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.publicSlug, slug), eq(templates.isPublic, true)))
    .limit(1);
  const tpl = rows[0];
  if (!tpl) {
    throw new HttpProblem({
      status: 404,
      title: 'Not Found',
      detail: 'This signing link is not available.',
    });
  }
  const roleRows = await db
    .select({ id: templateRoles.id })
    .from(templateRoles)
    .where(eq(templateRoles.templateId, tpl.id));
  const role = roleRows[0];
  if (!role || roleRows.length !== 1) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'This template is not configured for public signing.',
    });
  }
  const env = await instantiateTemplate(db, storage, tpl.userId, tpl.id, {
    signers: [{ roleId: role.id, name: signer.name, email: signer.email }],
  });
  await sendEnvelope(db, tpl.userId, env.id, ctx);
  const sRows = await db
    .select({ token: signers.signingToken })
    .from(signers)
    .where(eq(signers.envelopeId, env.id))
    .limit(1);
  const token = sRows[0]?.token;
  if (!token) {
    throw new Error('No signer token after public start');
  }
  return { token };
}
