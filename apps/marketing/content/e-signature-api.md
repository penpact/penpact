---
title: "E-signature API: how to add electronic signatures to your app"
description: "What an e-signature API is, how it works, and how to embed legally-binding electronic signatures in your product with a typed SDK and AI field detection."
slug: e-signature-api
author: "Penpact Team"
publishedAt: "2026-06-04"
updatedAt: "2026-06-04"
keywords: [e-signature api, electronic signature api, esignature api, embed e-signature, pdf signature api, sign documents api]
---

# E-signature API: how to add electronic signatures to your app

An e-signature API is a programmable interface that lets your application send documents for signature, collect legally-binding electronic signatures, and return a sealed, tamper-evident PDF with an audit trail, all without sending users to a separate signing product. Instead of a person logging into a signing app and uploading a contract, your code creates the request, places the fields, and embeds the signing step inside your own interface. This page explains how an e-signature API works, what separates a good one from a frustrating one, and how to add signing to your product with [Penpact](/), the open-source e-signature engine.

## What is an e-signature API?

An e-signature API turns "get this document signed" into a few function calls. Your backend creates an envelope (a document plus its signers), uploads a PDF, places fields such as signature, name, and date, and sends it. Each signer gets a secure link, consents to sign electronically, and signs by typing or drawing. The API flattens those values into the PDF, applies a digital seal, and produces a Certificate of Completion that records who signed, when, and from where. The defining trait is that all of this is driven by code, so signing becomes a feature of your product rather than a detour to someone else's.

## How does an e-signature API work, step by step?

Most e-signature APIs follow the same shape, and Penpact's is deliberately small. The flow is: create an envelope with the signers, upload the document, place the fields, then send. After that, each signer is invited, accepts the electronic-records disclosure, and signs; the engine seals the result and writes the audit trail. With Penpact that is roughly four calls before any signing happens:

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

const envelope = await penpact.createEnvelope({
  documentName: 'Mutual NDA',
  signers: [{ name: 'Ada Lovelace', email: 'ada@example.com' }],
});

await penpact.uploadDocument(envelope.id, pdfBytes);
await penpact.placeFields(envelope.id, [
  { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 72, y: 620, width: 200, height: 40 },
]);
await penpact.send(envelope.id);
```

For framework-specific versions, see the [Next.js integration guide](/embed-e-signatures-nextjs) and the [React guide](/embed-e-signatures-react).

## What makes a good e-signature API?

A good e-signature API is judged on integration, not feature-list length. Four things matter most:

- **A typed, readable SDK.** A small hand-written client beats a 200-method generated blob you have to learn. You should be able to read the whole surface in one sitting.
- **Real embedding.** Your signers should sign inside your product under your brand, not on a third-party page you style around.
- **Evidence built in.** Electronic-records consent, an append-only audit trail with IP and timestamps, a digital seal on the final PDF, and a hash-based certificate, so the result holds up.
- **Honest pricing.** Usage-based, without per-seat or per-page charges that punish you for making signing core to your product.

Penpact is built around exactly these. Field placement can also be automated: point a vision model at the PDF and it proposes the fields for you to adjust.

## Are e-signatures from an API legally binding?

Yes, electronic signatures collected through an API are legally binding in most jurisdictions when the process captures the right evidence. In the United States, the ESIGN Act (15 U.S.C. §7001) and UETA give electronic signatures the same legal effect as handwritten ones, provided there is intent to sign, consent to do business electronically, attribution to the signer, and a retained record. The European Union's eIDAS Regulation recognizes electronic signatures as well, with tiers from simple (SES) to qualified (QES). Penpact captures intent, electronic-records consent under the ESIGN Act, attribution by email and IP, and integrity through a SHA-256 hash plus a PAdES digital signature, targeting simple electronic signatures under ESIGN, UETA, and eIDAS. For higher-assurance qualified signatures (QES), you currently need a provider that supports them.

## Should you build or buy an e-signature API?

Building signing from scratch means owning PDF manipulation, field flattening, digital signing certificates, consent flows, an audit trail, and the legal nuance behind each, which is far more work than it looks. Buying a closed API solves that but ties you to one vendor's pricing and roadmap. An open-source API like Penpact is the middle path: you get a working engine you can read, self-host under AGPL-3.0, and extend, with a managed cloud available when you would rather not run infrastructure. You skip the years of building without giving up control of the source.

## How do you add an e-signature API to your product?

Start by getting an API key and sending one test envelope end to end, then wire the pieces into your app: create the envelope from a backend route, upload the document, place fields (by coordinate, in the visual builder, or with AI), send, and handle the completion webhook to know when it is done. With Penpact you can run the whole stack locally with `docker compose up`, which starts Postgres and the API and prints a working key, so the first signed document takes minutes rather than a sandbox-and-OAuth afternoon.

## Related

- [Open-source DocuSign alternative](/open-source-docusign-alternative)
- [Penpact vs DocuSign API](/penpact-vs-docusign)
- [Penpact vs Documenso](/penpact-vs-documenso)
- [Embed e-signatures in Next.js](/embed-e-signatures-nextjs)
- [Add e-signatures to React](/embed-e-signatures-react)
- [Penpact on GitHub](https://github.com/penpact/penpact)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "E-signature API: how to add electronic signatures to your app",
  "description": "What an e-signature API is, how it works, what makes one good, and how to embed legally-binding electronic signatures in your product.",
  "author": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "publisher": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "datePublished": "2026-06-04",
  "dateModified": "2026-06-04",
  "mainEntityOfPage": "https://penpact.dev/e-signature-api",
  "about": [
    { "@type": "SoftwareApplication", "name": "Penpact", "applicationCategory": "DeveloperApplication" }
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is an e-signature API?",
      "acceptedAnswer": { "@type": "Answer", "text": "An e-signature API is a programmable interface that lets your application send documents for signature, collect legally-binding electronic signatures, and return a sealed, tamper-evident PDF with an audit trail, all driven by code so signing happens inside your own product instead of a separate signing app." }
    },
    {
      "@type": "Question",
      "name": "Are e-signatures collected through an API legally binding?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes, in most jurisdictions, when the process captures intent, consent, attribution, and a retained record. In the US, the ESIGN Act (15 U.S.C. §7001) and UETA give electronic signatures the same legal effect as handwritten ones; the EU's eIDAS Regulation recognizes them with tiers from simple to qualified. Penpact targets simple electronic signatures under ESIGN, UETA, and eIDAS." }
    },
    {
      "@type": "Question",
      "name": "What makes a good e-signature API?",
      "acceptedAnswer": { "@type": "Answer", "text": "A typed, readable SDK over a large generated client; real embedding so signers stay in your product under your brand; evidence built in (consent, an append-only audit trail, a digital seal, and a hash-based certificate); and usage-based pricing without per-seat or per-page charges." }
    },
    {
      "@type": "Question",
      "name": "Should you build or buy an e-signature API?",
      "acceptedAnswer": { "@type": "Answer", "text": "Building from scratch means owning PDF manipulation, signing certificates, consent flows, and the legal nuance behind each. An open-source API like Penpact is the middle path: a working engine you can read, self-host under AGPL-3.0, and extend, with a managed cloud available when you prefer not to run infrastructure." }
    }
  ]
}
</script>
