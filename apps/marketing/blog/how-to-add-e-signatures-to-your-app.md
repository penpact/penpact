---
title: "How to add e-signatures to your app: a developer's guide"
description: "A practical, code-first guide to adding legally-binding e-signatures to your app: envelopes, field placement, embedding the signing flow, webhooks, and the sealed PDF."
slug: how-to-add-e-signatures-to-your-app
excerpt: "Envelopes, field placement, an embedded signing flow, webhooks, and a sealed PDF, with the exact calls. The whole thing in an afternoon, not a quarter."
author: "Penpact Team"
publishedAt: "2026-06-04"
updatedAt: "2026-06-04"
category: "Guide"
keywords: [add e-signatures to app, embed e-signature, e-signature api, electronic signature integration, sign documents api]
---

# How to add e-signatures to your app: a developer's guide

Adding e-signatures to your app comes down to five moves: create an envelope (the document plus its signers), upload a PDF, place the fields each signer must fill, send it, and react to a completion webhook. With a developer-first API you do not build PDF flattening, signing certificates, or consent flows yourself; you call them. This guide walks through the whole flow with real code, the parts people get wrong, and how to keep the result legally defensible. The examples use [Penpact](/e-signature-api), the open-source e-signature API, but the shape is the same with most modern providers.

## What you need before you start

You need three things: a backend that can hold a secret API key, a PDF to sign, and somewhere to receive a webhook. Signing must be initiated server-side, never from the browser, because the API key can create and send legally-binding documents on your account. The browser's only job is to render the signing step, which the API hands you as a secure, single-use link. If you take one thing from this guide, take that: keep the key on the server, and treat the signing link as the public surface.

## Step 1: Create an envelope

An envelope bundles a document with the people who must sign it. You create it with the document name and the signer list, and you get back IDs you will use for every later call. Order matters here: if you add signers in routing order, the API can invite them sequentially rather than all at once.

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

const envelope = await penpact.createEnvelope({
  documentName: 'Mutual NDA',
  signers: [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' },
  ],
});
```

## Step 2: Upload the document and place fields

Next, upload the PDF and tell the API where each signer signs. Fields are positioned by page and coordinate, with a top-left origin, which trips people up: a signature placed at the bottom of a US Letter page sits around y=700, not y=70. You have three ways to place fields: by coordinate in code, by hand in a visual builder, or by letting an AI model read the PDF and propose them.

```ts
await penpact.uploadDocument(envelope.id, pdfBytes);

await penpact.placeFields(envelope.id, [
  { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 72, y: 620, width: 200, height: 40 },
  { type: 'date',      signerId: envelope.signers[0].id, page: 1, x: 320, y: 620, width: 120, height: 24 },
]);
```

For contracts with many signature blocks, hand-placing every field is the most tedious part of the job. AI field detection removes most of it: point a vision model at the PDF and it proposes signature, name, and date fields for you to confirm. This is where a developer-first tool saves real time.

## Step 3: Send, then embed the signing experience

When you send the envelope, each signer is invited by email, and the API gives you a signing URL per signer. You can let people sign from the email link, or you can embed the signing step inside your own app so users never leave it. Embedding is the difference between "we use a signing tool" and "signing is a feature of our product."

```ts
await penpact.send(envelope.id);
// Each signer object now carries a signing URL you can open in your UI.
```

For the framework-specific version, see the [Next.js integration guide](/embed-e-signatures-nextjs) or the [React guide](/embed-e-signatures-react). The key UX rule: theme the signing page to your brand, and bring the signer back to your app on completion rather than dropping them on a generic "thanks" screen.

## Step 4: Handle the completion webhook

Polling for status is a smell. Instead, register a webhook and let the API tell you when something happens. You will care about a few events: the envelope being sent, a signer signing, and the envelope completing. Verify the signature header on every delivery so you only act on real events, then do your own work, such as provisioning an account or unlocking a feature.

```ts
// Express-style handler
app.post('/webhooks/penpact', (req, res) => {
  const valid = penpact.verifyWebhook(req.headers['penpact-signature'], req.rawBody);
  if (!valid) return res.status(400).end();

  const event = JSON.parse(req.rawBody);
  if (event.type === 'envelope.completed') {
    // Fetch the sealed PDF + certificate, mark the deal done, etc.
  }
  res.status(200).end();
});
```

## Step 5: Store the sealed PDF and the certificate

When everyone has signed, the API flattens the field values into the document, applies a digital seal, and produces a Certificate of Completion that records who signed, when, and from which IP. Download both and store them with your record of the transaction. The sealed PDF is the document you hand to a court or a counterparty; the certificate is the evidence trail behind it. Do not skip storing the certificate, because it is what makes the signature defensible later.

## What makes an embedded e-signature legally binding?

An embedded e-signature is legally binding when the flow captures four things: intent to sign, consent to do business electronically, attribution to the signer, and an unaltered record. In the United States, the ESIGN Act and UETA give a compliant electronic signature the same legal effect as a handwritten one. A good API captures these for you: an explicit electronic-records disclosure, an append-only audit trail with timestamps and IP, and a hash plus digital signature that proves the final PDF was not changed. For the legal detail, see [Are electronic signatures legally binding?](/blog/are-electronic-signatures-legally-binding).

## Common mistakes when adding e-signatures

A few errors show up again and again:

- **Calling the API from the browser.** The key belongs on the server. Always.
- **Flipping the Y axis.** Most signing APIs use a top-left origin; PDF tools often use bottom-left. Place one field, render it, and check before placing fifty.
- **Skipping the consent step.** Without recorded electronic-records consent, the signature is weaker. Do not suppress the disclosure to save a click.
- **Polling instead of using webhooks.** It is slower, costs more, and races. Verify the signature and react to events.
- **Throwing away the certificate.** The sealed PDF alone is not the whole story; the certificate is the evidence.

## Build it yourself this afternoon

The fastest way to understand the flow is to run it once end to end. With Penpact, `docker compose up` starts Postgres and the API and prints a working key, so you can create, send, and sign a test envelope locally in minutes, then wire the same five steps into your product. Start from the [e-signature API overview](/e-signature-api), or [get an API key](https://api.penpact.dev/app) and send your first envelope.

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How to add e-signatures to your app: a developer's guide",
  "description": "A practical, code-first guide to adding legally-binding e-signatures to your app: envelopes, field placement, embedding the signing flow, webhooks, and the sealed PDF.",
  "author": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "publisher": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev", "logo": { "@type": "ImageObject", "url": "https://penpact.dev/favicon.svg" } },
  "datePublished": "2026-06-04",
  "dateModified": "2026-06-04",
  "mainEntityOfPage": "https://penpact.dev/blog/how-to-add-e-signatures-to-your-app",
  "keywords": "add e-signatures to app, embed e-signature, e-signature api, electronic signature integration"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do you add e-signatures to an app?",
      "acceptedAnswer": { "@type": "Answer", "text": "Use an e-signature API and follow five steps: create an envelope with the document and signers, upload the PDF, place the fields each signer must fill, send it, and handle a completion webhook. The API flattens the values, seals the PDF, and produces a Certificate of Completion, so you do not build PDF signing yourself." }
    },
    {
      "@type": "Question",
      "name": "Can you call an e-signature API from the browser?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. The API key can create and send legally-binding documents, so it must stay on your server. The browser only renders the signing step, which the API provides as a secure, single-use link per signer." }
    },
    {
      "@type": "Question",
      "name": "How do you embed the signing experience in your own product?",
      "acceptedAnswer": { "@type": "Answer", "text": "Send the envelope server-side, take the per-signer signing URL the API returns, and open it inside your own themed UI rather than relying on the email link. Bring the signer back to your app on completion. Penpact provides a typed SDK and an embeddable, brand-themeable signing flow for this." }
    }
  ]
}
</script>
