---
title: "Add e-signatures to a React app"
description: "Add document signing to a React app with the Penpact API. Call your backend to create and send envelopes, then redirect signers to the signing link."
slug: embed-e-signatures-react
keywords: [react e-signature, add e-signature react, react signing api, embed signing react]
---

# Add e-signatures to a React app

A React frontend should never hold your Penpact API key. The pattern is: your React app calls your
own backend, your backend talks to Penpact, and the signer is sent to a signing link. This page
shows the frontend half and the small backend call it depends on.

## The flow

1. User clicks "Send for signature" in your React UI.
2. Your backend creates a Penpact envelope, uploads the PDF, places fields, and sends it.
3. Penpact emails the signer a link, or your backend returns it for an in-app redirect.

## Frontend (React)

```tsx
import { useState } from 'react';

export function SendForSignature({ documentName }: { documentName: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function send() {
    setStatus('sending');
    await fetch('/api/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentName, name: 'Bob', email: 'bob@example.com' }),
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

export async function createAndSend(input: { documentName: string; name: string; email: string }, pdf: Uint8Array) {
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

## Where signers actually sign

Today the signer signs through Penpact's hosted signing session reached by the link in their email.
A drop-in `<Sign/>` React component that renders the signing experience inside your own app is on
the roadmap. Until then, redirect to the signing link or rely on the email.

Penpact is open source under AGPL-3.0, so you can self-host the API and keep every document on your
own infrastructure.

[Penpact on GitHub](https://github.com/penpact/penpact) · [Embed in Next.js](/embed-e-signatures-nextjs)
