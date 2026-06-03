---
title: "Add e-signatures to a React app"
description: "Add e-signatures to a React app with the Penpact API. Call your backend to create and send envelopes, then send signers to the signing link. Full code."
slug: embed-e-signatures-react
author: "Penpact Team"
publishedAt: "2026-06-03"
updatedAt: "2026-06-03"
keywords: [react e-signature, add e-signature react, react signing api, embed signing react]
---

# Add e-signatures to a React app

To add e-signatures to a React app, keep your Penpact API key on a backend, have React call that
backend, and send the signer to a signing link. A React frontend should never hold the API key
directly. This page shows the frontend half and the small backend call it depends on.

Penpact is in early development (v0.1.0, June 2026). The API may change, so pin the SDK version in
production.

## The flow

1. A user clicks "Send for signature" in your React UI.
2. Your backend creates a Penpact envelope, uploads the PDF, places fields, and sends it.
3. Penpact emails the signer a link, or your backend returns it for an in-app redirect.

## Frontend (React)

Pass the signer's name and email in as props rather than hardcoding them, so the component works for
any signer.

```tsx
import { useState } from 'react';

type Props = {
  documentName: string;
  signerName: string;
  signerEmail: string;
};

export function SendForSignature({ documentName, signerName, signerEmail }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function send() {
    setStatus('sending');
    await fetch('/api/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentName, name: signerName, email: signerEmail }),
    });
    setStatus('sent');
  }

  return (
    <button onClick={send} disabled={status !== 'idle'}>
      {status === 'sent' ? 'Sent for signature' : 'Send for signature'}
    </button>
  );
}
```

## Backend (the part that holds the key)

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

export async function createAndSend(
  input: { documentName: string; name: string; email: string },
  pdf: Uint8Array,
) {
  const envelope = await penpact.createEnvelope({
    documentName: input.documentName,
    signers: [{ name: input.name, email: input.email }],
  });
  await penpact.uploadDocument(envelope.id, pdf);
  await penpact.placeFields(envelope.id, [
    { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 100, y: 600, width: 180, height: 40 },
  ]);
  await penpact.send(envelope.id);
  return envelope.id;
}
```

## Where do signers actually sign?

Today the signer signs through Penpact's hosted signing session, reached by the link in their email.
A drop-in `<Sign/>` React component that renders the signing experience inside your own app is on
the roadmap. Until then, redirect to the signing link or rely on the email.

Penpact is open source under AGPL-3.0, so you can self-host the API and keep every document on your
own infrastructure.

## Related

- [Embed e-signatures in Next.js](/embed-e-signatures-nextjs)
- [Open-source DocuSign alternative](/open-source-docusign-alternative)
- [Penpact vs DocuSign API](/penpact-vs-docusign)
- [Penpact on GitHub](https://github.com/penpact/penpact)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Add e-signatures to a React app",
  "description": "Add e-signatures to a React app with the Penpact API. Call your backend to create and send envelopes, then send signers to the signing link.",
  "author": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "publisher": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "datePublished": "2026-06-03",
  "dateModified": "2026-06-03",
  "mainEntityOfPage": "https://penpact.dev/embed-e-signatures-react",
  "proficiencyLevel": "Beginner",
  "dependencies": "React, @penpact/sdk",
  "programmingLanguage": "TypeScript"
}
</script>
