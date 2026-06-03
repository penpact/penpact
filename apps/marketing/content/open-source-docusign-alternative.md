---
title: "Open-source DocuSign alternative for developers"
description: "Penpact is an open-source, embeddable e-signature API. Self-host it (AGPL-3.0) or use the managed cloud. Typed SDK, AI field detection, audit trail, no per-page billing."
slug: open-source-docusign-alternative
keywords: [open source docusign alternative, e-signature api, self-hosted e-signature, embeddable signing api, docusign api alternative]
---

# Open-source DocuSign alternative for developers

**Penpact is an open-source e-signature API you embed in your own product.** You can self-host it
under AGPL-3.0 or use the managed cloud. Your users sign documents inside your app, under your
brand, and you get a legally-valid audit trail and a Certificate of Completion. There is no
per-page or per-seat billing.

If you have used the DocuSign API, the friction is familiar: per-envelope pricing, seat minimums,
an SDK that feels like a SOAP wrapper, and an iframe you bolt on rather than a component you drop in.
Penpact takes the opposite stance. The core engine is open source, the signing surface is a real
TypeScript SDK, and field placement can be done by AI instead of by hand.

## How Penpact compares

| | Penpact | DocuSign API | Dropbox Sign API | DocuSeal / Documenso |
|---|---|---|---|---|
| Open source | Yes (AGPL-3.0) | No | No | Yes |
| Self-host | Yes (`docker compose up`) | No | No | Yes |
| AI field detection | Yes | Add-on | No | No |
| First-class TypeScript SDK | Yes | Partial | Partial | Partial |
| Pricing model | usage-based, no seats | per-envelope + seats | per-signature | self-host / SaaS |
| Audit trail + Certificate of Completion | Yes | Yes | Yes | Yes |

Verify current vendor pricing and features before you rely on this table. It reflects public
positioning in 2026.

## Why open source matters here

Signing touches your most sensitive documents, so "trust us" is a weak answer. With Penpact you can
read the code, run it on your own infrastructure, and verify how signatures and the audit trail are
captured. The license is AGPL-3.0: you can self-host freely, but you cannot ship the code inside a
closed competing product without open-sourcing yours. If you would rather not run the infrastructure,
the managed cloud is there.

## What you get

You create an envelope, upload a PDF, place fields (by hand or with AI), and send it. Each signer
authenticates by an emailed link, accepts the electronic-records consent disclosure required by the
US ESIGN Act, and signs. Every step is written to an append-only event log. When the last signer is
done, Penpact flattens the values into the PDF, applies a PAdES digital signature, hashes the result
with SHA-256, and generates a Certificate of Completion.

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });
const envelope = await penpact.createEnvelope({
  documentName: 'NDA',
  signers: [{ name: 'Bob', email: 'bob@example.com' }],
});
```

## Honest status

Penpact is in early development. The API is not stable yet, the consent text still needs a lawyer's
review, and the default PAdES certificate is self-signed unless you supply your own. We would rather
say that plainly than oversell it. The code is on GitHub and the issues are open.

## FAQ

**Is Penpact really free?**
The core engine is free and open source under AGPL-3.0. You pay only if you use the managed cloud or
need features like white-label or higher limits.

**Can I self-host it?**
Yes. `docker compose up` starts Postgres and the API and prints a working API key. See the README.

**Does it support legally-valid e-signatures?**
It captures the evidence courts look for under US ESIGN/UETA and EU eIDAS (simple electronic
signatures): intent, consent, attribution, and document integrity. Validity always depends on your
facts and jurisdiction, so check with counsel for high-stakes documents.

**What about DocuSeal and Documenso?**
Both are good open-source projects. Penpact's bet is developer experience: a typed SDK, AI field
detection, and an API designed to embed rather than to be used as a standalone app.

[View Penpact on GitHub](https://github.com/penpact/penpact)
