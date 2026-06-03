---
title: "Open-source DocuSign alternative for developers"
description: "Penpact is an open-source DocuSign alternative for developers. Self-host under AGPL-3.0 or use the managed cloud. No per-envelope or per-seat billing."
slug: open-source-docusign-alternative
author: "Penpact Team"
publishedAt: "2026-06-03"
updatedAt: "2026-06-03"
keywords: [open source docusign alternative, e-signature api, self-hosted e-signature, embeddable signing api, docusign api alternative]
---

# Open-source DocuSign alternative for developers

Penpact is an open-source DocuSign API alternative (AGPL-3.0, the GNU Affero General Public License)
that you embed directly in your own product. Unlike DocuSign, which bills per envelope and per seat
and embeds through a hosted iframe, Penpact ships as a TypeScript SDK with no seat minimums, no
per-page billing, and a signing surface that feels native to your app. You can self-host the whole
stack with `docker compose up` or use the managed cloud. Every signing session captures the evidence
required by the US ESIGN Act (Electronic Signatures in Global and National Commerce Act, 15 U.S.C.
§7001) and EU eIDAS, writes an append-only audit trail, and seals the final PDF with a PAdES (PDF
Advanced Electronic Signatures) digital signature plus a SHA-256 Certificate of Completion.

If you have used the DocuSign API, the friction is familiar: per-envelope pricing, seat minimums, a
verbose generated SDK, and an iframe you bolt on instead of a component you drop in. Penpact takes
the opposite stance. The core engine is open source, the signing surface is a typed TypeScript SDK,
and field placement can be done by AI (point Claude at the PDF; set `ANTHROPIC_API_KEY` to enable it
when self-hosting).

## How Penpact compares to DocuSign and other e-signature APIs

Penpact is the only option in this table that is open source, self-hostable, and includes AI field
detection without an add-on charge.

| | Penpact | DocuSign API | Dropbox Sign API | DocuSeal / Documenso |
|---|---|---|---|---|
| Open source | Yes (AGPL-3.0) | No | No | Yes |
| Self-host | Yes (`docker compose up`) | No | No | Yes |
| AI field detection | Yes (included) | Add-on | No | No |
| First-class TypeScript SDK | Yes | Partial | Partial | Partial |
| Pricing model | usage-based, no seats | per-envelope + seats | per-signature | self-host / SaaS |
| Audit trail + Certificate of Completion | Yes | Yes | Yes | Yes |

Pricing and features reflect public positioning in 2026. Verify current vendor details before you
rely on this table.

## Why does open source matter for an e-signature API?

Signing touches your most sensitive documents, so "trust us" is a weak answer. With this self-hosted
e-signature option you can read the code, run it on your own infrastructure, and verify exactly how
signatures and the audit trail are captured. The license is AGPL-3.0: you can self-host freely, but
you cannot ship the code inside a closed competing product without open-sourcing yours. If you would
rather not run the self-hosted infrastructure, the managed cloud is there.

## What you get with this embeddable signing API

You create an envelope, upload a PDF, place fields (by hand or with AI), and send it. Each signer
authenticates by an emailed link, accepts the electronic-records consent disclosure required by US
ESIGN §7001(c), and signs. Every step is written to an append-only event log. When the last signer
is done, Penpact flattens the values into the PDF, applies a PAdES digital signature, hashes the
result with SHA-256, and generates a Certificate of Completion.

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });
const envelope = await penpact.createEnvelope({
  documentName: 'NDA',
  signers: [{ name: 'Bob', email: 'bob@example.com' }],
});
```

## Honest status

Penpact is in early development (v0.1.0, released June 2026). The API is not stable yet, the consent
text still needs a lawyer's review, and the default PAdES certificate is self-signed unless you
supply your own. We would rather say that plainly than oversell it. The code is on GitHub and the
issues are open.

## FAQ

### Is Penpact free to use?

Penpact's core engine is free and open source under AGPL-3.0. Self-hosting is free with no usage
limits. You pay only for the managed cloud tier or optional features such as white-label branding or
higher rate limits.

### Can I self-host Penpact?

Yes. Running `docker compose up` starts a Postgres database and the Penpact API and prints a working
API key in under two minutes. The full source is on GitHub at github.com/penpact/penpact.

### Does Penpact produce legally valid e-signatures?

Penpact captures the four elements courts look for under the US ESIGN Act (15 U.S.C. §7001) and UETA
(the Uniform Electronic Transactions Act), and qualifies as a simple electronic signature (SES)
under EU eIDAS: signer intent, electronic-records consent, attribution (email and IP), and document
integrity (SHA-256 hash plus PAdES seal). Validity depends on your jurisdiction and document type,
so consult counsel for high-stakes agreements.

### How does Penpact compare to DocuSeal and Documenso?

DocuSeal and Documenso are solid open-source projects. Penpact's bet is developer experience: a
fully-typed TypeScript SDK, AI field detection that proposes signature, date, and name placements
from the PDF automatically, and an API designed to embed into a product rather than run as a
standalone app.

## Related

- [Penpact vs DocuSign API](/penpact-vs-docusign)
- [Embed e-signatures in a Next.js app](/embed-e-signatures-nextjs)
- [Add e-signatures to a React app](/embed-e-signatures-react)
- [Penpact on GitHub](https://github.com/penpact/penpact)

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Penpact",
  "url": "https://penpact.dev",
  "description": "Open-source, embeddable e-signature API. Self-host under AGPL-3.0 or use the managed cloud. Typed TypeScript SDK, AI field detection, append-only audit trail, Certificate of Completion, no per-page or per-seat billing.",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Linux, macOS, Windows",
  "softwareVersion": "0.1.0",
  "license": "https://www.gnu.org/licenses/agpl-3.0.html",
  "isAccessibleForFree": true,
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "codeRepository": "https://github.com/penpact/penpact",
  "programmingLanguage": "TypeScript",
  "creator": { "@type": "Organization", "name": "Penpact", "url": "https://penpact.dev" },
  "sameAs": "https://github.com/penpact/penpact"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Is Penpact free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Penpact's core engine is free and open source under AGPL-3.0. Self-hosting is free with no usage limits. You pay only for the managed cloud tier or optional features such as white-label branding or higher rate limits." } },
    { "@type": "Question", "name": "Can I self-host Penpact?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Running docker compose up starts a Postgres database and the Penpact API and prints a working API key in under two minutes. The full source is on GitHub." } },
    { "@type": "Question", "name": "Does Penpact produce legally valid e-signatures?", "acceptedAnswer": { "@type": "Answer", "text": "Penpact captures signer intent, electronic-records consent (US ESIGN Act §7001(c)), attribution, and document integrity (SHA-256 plus PAdES seal), qualifying as a simple electronic signature under US ESIGN/UETA and EU eIDAS SES. Validity depends on jurisdiction and document type." } }
  ]
}
</script>
