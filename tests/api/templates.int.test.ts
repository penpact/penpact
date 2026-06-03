import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { generateApiKey } from '@penpact/api/crypto';
import { getStorage } from '@penpact/api/storage';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  instantiateTemplate,
  listTemplates,
  placeTemplateFields,
  uploadTemplateDocument,
} from '@penpact/api/templates';
import { apiKeys, createDatabase, type Database, signers, users } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;

async function onePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)('document templates (integration)', () => {
  let db: Database;
  let userId = '';
  let apiKey = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const user = (
      await db
        .insert(users)
        .values({ email: `tpl-${randomUUID()}@penpact.test` })
        .returning()
    )[0];
    userId = user?.id as string;
    const gen = generateApiKey('test');
    apiKey = gen.key;
    await db.insert(apiKeys).values({ userId, name: 'tpl', prefix: gen.prefix, keyHash: gen.hash });
  });

  async function readyTemplate(): Promise<{ id: string; roleId: string }> {
    const tpl = await createTemplate(db, userId, {
      name: 'NDA template',
      documentName: 'Mutual NDA',
      roles: [{ name: 'Signer', routingOrder: 1 }],
    });
    const roleId = tpl.roles[0]?.id as string;
    await uploadTemplateDocument(db, getStorage(), userId, tpl.id, await onePagePdf());
    await placeTemplateFields(db, userId, tpl.id, {
      fields: [{ type: 'signature', roleId, page: 1, x: 72, y: 600, width: 160, height: 40 }],
    });
    return { id: tpl.id, roleId };
  }

  it('creates a template with roles and lists/gets it', async () => {
    const tpl = await createTemplate(db, userId, {
      name: 'My template',
      documentName: 'Doc',
      roles: [{ name: 'Client' }, { name: 'Manager', routingOrder: 2 }],
    });
    expect(tpl.roles).toHaveLength(2);
    expect(tpl.roles.every((r) => r.id)).toBe(true);

    const list = await listTemplates(db, userId);
    expect(list.find((t) => t.id === tpl.id)).toBeTruthy();

    const got = await getTemplate(db, userId, tpl.id);
    expect(got?.roles).toHaveLength(2);
    // another user cannot read it
    expect(await getTemplate(db, randomUUID(), tpl.id)).toBeNull();
  });

  it('uploads a document and places fields (rejecting a foreign role)', async () => {
    const tpl = await createTemplate(db, userId, {
      name: 'T',
      documentName: 'D',
      roles: [{ name: 'A' }],
    });
    const roleId = tpl.roles[0]?.id as string;
    const uploaded = await uploadTemplateDocument(
      db,
      getStorage(),
      userId,
      tpl.id,
      await onePagePdf(),
    );
    expect(uploaded.pageCount).toBe(1);
    expect(uploaded.storageKey).toBeTruthy();

    const placed = await placeTemplateFields(db, userId, tpl.id, {
      fields: [{ type: 'signature', roleId, page: 1, x: 10, y: 10, width: 100, height: 30 }],
    });
    expect(placed).toHaveLength(1);

    await expect(
      placeTemplateFields(db, userId, tpl.id, {
        fields: [
          { type: 'signature', roleId: randomUUID(), page: 1, x: 1, y: 1, width: 10, height: 10 },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('instantiates a template into a draft envelope that can be sent and signed', async () => {
    const { id, roleId } = await readyTemplate();

    await expect(
      instantiateTemplate(db, getStorage(), userId, id, { signers: [] }),
    ).rejects.toMatchObject({ status: 422 });

    const envelope = await instantiateTemplate(db, getStorage(), userId, id, {
      signers: [{ roleId, name: 'Grace', email: 'grace@x.test' }],
    });
    expect(envelope.status).toBe('draft');
    expect(envelope.signers).toHaveLength(1);
    expect(envelope.signers[0]?.email).toBe('grace@x.test');
    expect(envelope.fields).toHaveLength(1);
    expect(envelope.fields[0]?.signerId).toBe(envelope.signers[0]?.id);

    // the instantiated envelope flows through send + sign
    const sent = await app.request(`/v1/envelopes/${envelope.id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(sent.status).toBe(200);
    const token = (
      await db
        .select({ t: signers.signingToken })
        .from(signers)
        .where(eq(signers.id, envelope.signers[0]?.id as string))
    )[0]?.t as string;
    const session = await (await app.request(`/v1/sign/${token}`)).json();
    await app.request(`/v1/sign/${token}/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ disclosureHash: session.consentDisclosure.hash, agree: true }),
    });
    const done = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signatureType: 'typed',
        fields: [{ fieldId: session.fields[0].id, value: 'Grace' }],
      }),
    });
    expect(done.status).toBe(200);
  });

  it('deletes a template', async () => {
    const tpl = await createTemplate(db, userId, {
      name: 'X',
      documentName: 'X',
      roles: [{ name: 'R' }],
    });
    await deleteTemplate(db, userId, tpl.id);
    expect(await getTemplate(db, userId, tpl.id)).toBeNull();
  });
});
