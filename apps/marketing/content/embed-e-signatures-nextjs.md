---
title: "Embed e-signatures in a Next.js app"
description: "Embed e-signatures in a Next.js app with the Penpact API and TypeScript SDK. Create envelopes from a route handler, place fields, and send for signing."
slug: embed-e-signatures-nextjs
author: "Penpact Team"
publishedAt: "2026-06-03"
updatedAt: "2026-06-03"
keywords: [next.js e-signature, embed e-signature next.js, nextjs signing api, e-signature api typescript]
---

# Embed e-signatures in a Next.js app

To embed e-signatures in a Next.js app, install the Penpact SDK, create an envelope from a server
route handler so your secret API key never reaches the browser, place fields, and send it. The
signer gets a link and signs in the browser. This guide walks through each step with copy-paste code.

Penpact is in early development (v0.1.0, June 2026), so treat the API as subject to change and pin
the SDK version in production.

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

## 3. Let AI place the fields (optional)

If you do not want to compute coordinates by hand, ask Penpact to detect them, review the proposals,
then pass them to `placeFields`. This step uses Claude to read the PDF, so it needs an
`ANTHROPIC_API_KEY` configured on the server you are calling. Without one, the endpoint returns an
empty list rather than an error, and you fall back to manual placement.

```ts
const res = await fetch(`https://api.penpact.dev/v1/envelopes/${id}/fields/auto-detect`, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.PENPACT_API_KEY}` },
});
const { data: proposedFields } = await res.json();
```

## 4. Track completion with a webhook

Point a webhook at a route handler and verify the `Penpact-Signature` header (an HMAC-SHA256 of the
raw body) before trusting it. You will receive `envelope.completed` when every signer is done, after
which you can download the sealed PDF and the Certificate of Completion.

## Is a Next.js e-signature this way legally valid?

The signer flow records electronic-records consent under the US ESIGN Act (15 U.S.C. §7001(c)),
writes an append-only audit trail with IP and timestamp, and seals the final PDF with a PAdES
digital signature and a SHA-256 hash. That captures the evidence for a simple electronic signature
under US ESIGN/UETA and EU eIDAS. Validity still depends on your jurisdiction and document type, so
consult counsel for high-stakes agreements.

## Notes

Penpact is open source (AGPL-3.0). You can self-host the whole thing or use the cloud.

## Related

- [Add e-signatures to a React app](/embed-e-signatures-react)
- [Open-source DocuSign alternative](/open-source-docusign-alternative)
- [Penpact vs DocuSign API](/penpact-vs-docusign)
- [Penpact on GitHub](https://github.com/penpact/penpact)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Embed e-signatures in a Next.js app",
  "description": "Embed e-signatures in a Next.js app with the Penpact API and TypeScript SDK. Create envelopes from a route handler, place fields, and send for signing.",
  "author": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "publisher": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "datePublished": "2026-06-03",
  "dateModified": "2026-06-03",
  "mainEntityOfPage": "https://penpact.dev/embed-e-signatures-nextjs",
  "proficiencyLevel": "Beginner",
  "dependencies": "Next.js, @penpact/sdk",
  "programmingLanguage": "TypeScript"
}
</script>
