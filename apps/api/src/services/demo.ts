/**
 * One-click public demo. `GET /demo` spins a fresh envelope from a sample
 * contract, places fields on it, and returns a signing token so a visitor can
 * try the full signer experience without an account, an install, or an email.
 * No invite email is sent (there is no real recipient), and everything runs
 * under a single internal demo account.
 */
import { type Database, documents, envelopes, signers, users } from '@penpact/db';
import { eq, sql } from 'drizzle-orm';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateSigningToken } from '../lib/crypto.js';
import { hashPassword } from '../lib/password.js';
import type { Storage } from '../storage/index.js';
import { autoDetectEnvelopeFields } from './ai-fields.js';
import { uploadDocument } from './documents.js';
import { createEnvelope } from './envelopes.js';
import { placeFields } from './fields.js';
import { createOrganization, personalOrgId } from './organizations.js';

const DEMO_EMAIL = 'demo@penpact.local';

async function buildDemoPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  let y = 740;
  const ink = rgb(0.1, 0.1, 0.12);
  const line = (text: string, f = font, size = 11, dy = 16) => {
    page.drawText(text, { x: 64, y, size, font: f, color: ink });
    y -= dy;
  };
  line('MUTUAL NON-DISCLOSURE AGREEMENT', bold, 17, 30);
  line('This sample agreement is provided by Penpact so you can try the signing flow.', font, 11, 22);
  line('1. Each party will keep the other party confidential information confidential.', font, 11, 18);
  line('2. This obligation lasts for three (3) years from the date of signing.', font, 11, 18);
  line('3. Nothing here grants a license to any intellectual property.', font, 11, 28);
  line('COUNTERPARTY', bold, 12, 24);
  line('Signature: ______________________________', font, 11, 26);
  line('Full name: _______________________________', font, 11, 26);
  line('Date: ____________________________________', font, 11, 26);
  return doc.save();
}

async function ensureDemoUser(db: Database): Promise<{ userId: string; orgId: string }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
    .limit(1);
  if (existing[0]) {
    return { userId: existing[0].id, orgId: await personalOrgId(db, existing[0].id) };
  }
  const hash = await hashPassword(generateSigningToken() + generateSigningToken());
  const inserted = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: 'Penpact Demo', passwordHash: hash })
    .returning({ id: users.id });
  const userId = inserted[0]?.id;
  if (!userId) throw new Error('startDemo: could not create the demo account');
  await createOrganization(db, userId, 'Penpact Demo');
  return { userId, orgId: await personalOrgId(db, userId) };
}

/** Create a ready-to-sign demo envelope and return its signing token. */
export async function startDemo(db: Database, storage: Storage): Promise<string> {
  const { userId, orgId } = await ensureDemoUser(db);
  const env = await createEnvelope(
    db,
    userId,
    {
      documentName: 'Penpact Demo: Mutual NDA',
      signers: [{ name: 'You (demo signer)', email: 'you@example.com' }],
    },
    'live',
    orgId,
  );
  const signerId = env.signers[0]?.id;
  if (!signerId) throw new Error('startDemo: envelope has no signer');

  await uploadDocument(db, storage, userId, env.id, await buildDemoPdf());

  // Prefer line-accurate auto-detected placements; fall back to fixed boxes.
  const proposals = await autoDetectEnvelopeFields(db, storage, userId, env.id).catch(() => []);
  const detected = proposals
    .filter((p) => ['signature', 'name', 'date'].includes(p.type))
    .map((p) => ({
      type: p.type as 'signature' | 'name' | 'date',
      signerId,
      page: p.page,
      x: Math.round(p.x),
      y: Math.round(p.y),
      width: Math.round(p.width),
      height: Math.round(p.height),
      required: true,
    }));
  const fields =
    detected.some((f) => f.type === 'signature') && detected.length >= 3
      ? detected
      : [
          { type: 'signature' as const, signerId, page: 1, x: 128, y: 250, width: 210, height: 22, required: true },
          { type: 'name' as const, signerId, page: 1, x: 116, y: 276, width: 220, height: 18, required: true },
          { type: 'date' as const, signerId, page: 1, x: 92, y: 302, width: 150, height: 18, required: true },
        ];
  await placeFields(db, userId, env.id, { fields });

  // Activate the envelope without emailing (the demo has no real recipient).
  await db.update(envelopes).set({ status: 'sent' }).where(eq(envelopes.id, env.id));

  const tokenRow = await db
    .select({ token: signers.signingToken })
    .from(signers)
    .where(eq(signers.envelopeId, env.id))
    .limit(1);
  const token = tokenRow[0]?.token;
  if (!token) throw new Error('startDemo: signing token not found');
  return token;
}
