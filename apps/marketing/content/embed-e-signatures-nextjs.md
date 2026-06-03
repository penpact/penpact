---
title: "Embed e-signatures in a Next.js app"
description: "Add legally-valid e-signatures to a Next.js application with the Penpact API and TypeScript SDK. Create envelopes from a route handler, place fields, and send for signing."
slug: embed-e-signatures-nextjs
keywords: [next.js e-signature, embed e-signature next.js, nextjs signing api, e-signature api typescript]
---

# Embed e-signatures in a Next.js app

This guide adds document signing to a Next.js app using the Penpact API. You keep your secret API
key on the server (in a route handler), create an envelope, place fields, and send it. The signer
gets a link and signs in the browser.

## 1. Install the SDK

```bash
pnpm add @penpact/sdk
```

Set your key in `.env.local`:

```
PENPACT_API_KEY=pk_live_your_key
```

Get a key by self-hosting (`docker compose up` prints one) or from the managed cloud.

## 2. Create an envelope from a Route Handler

Keep the key server-side. Never instantiate the client in a Client Component.

```ts
// app/api/sign/route.ts
import { PenpactClient } from '@penpact/sdk';
import { NextResponse } from 'next/server';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

export async function POST(req: Request) {
  const { name, email, documentName } = await req.json();

  const envelope = await penpact.createEnvelope({
    documentName,
    signers: [{ name, email }],
  });

  // Upload the PDF you want signed (a Uint8Array).
  const pdf = await fetch(new URL('/contract.pdf', req.url)).then((r) => r.arrayBuffer());
  await penpact.uploadDocument(envelope.id, new Uint8Array(pdf));

  // Place a signature field for the signer, then send.
  await penpact.placeFields(envelope.id, [
    { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 100, y: 600, width: 180, height: 40 },
  ]);
  await penpact.send(envelope.id);

  return NextResponse.json({ envelopeId: envelope.id });
}
```

## 3. Let AI place the fields

If you do not want to compute coordinates, ask Penpact to detect them, then send the proposals to
`placeFields` after a quick review:

```ts
const res = await fetch(`https://api.penpact.dev/v1/envelopes/${id}/fields/auto-detect`, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.PENPACT_API_KEY}` },
});
const { data: proposedFields } = await res.json();
```

## 4. Track completion with a webhook

Point a webhook at a route handler and verify the `Penpact-Signature` header (HMAC-SHA256 of the
raw body) before trusting it. You will receive `envelope.completed` when every signer is done, after
which you can download the sealed PDF and the Certificate of Completion.

## Notes

Penpact is open source (AGPL-3.0). You can self-host the whole thing or use the cloud. The signer
flow captures consent (US ESIGN §7001(c)) and an append-only audit trail, and the final PDF gets a
PAdES digital signature.

[Penpact on GitHub](https://github.com/penpact/penpact) · [Open-source DocuSign alternative](/open-source-docusign-alternative)
