<div align="center">

# Penpact

**Open-source, embeddable e-signature API — the developer-first, open DocuSign alternative.**

Point it at any PDF, drop a themeable `<Sign/>` component into your app, and capture a
legally-valid audit trail. No per-page billing, no seats.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Status: early development](https://img.shields.io/badge/status-early%20development-orange.svg)](#status)

[Website](https://penpact.dev) · [Docs](https://penpact.dev/docs) · [Roadmap](#roadmap)

</div>

<p align="center"><img src="docs/assets/flow.svg" alt="Penpact signing flow: create envelope, place fields (manual or AI), send, sign with consent, PAdES seal, certificate + webhook" width="100%"></p>

---

> **Status: early development.** The core signing engine is being built in the open. Stars and
> issues are welcome; the API is not yet stable. Watch the repo to follow the first release.

## Why Penpact

Building document signing yourself is costly and legally risky, and the incumbents are expensive
and painful to integrate. Penpact is the engine you embed so **your** users sign documents inside
**your** product — under your brand.

- **AI field auto-placement** — point at any PDF; signature/date/name fields are detected and placed.
- **True drop-in SDK** — a themeable `<Sign/>` React component + idiomatic, fully-typed clients.
- **Credible compliance at usage price** — real audit trail, Certificate of Completion, SHA-256 +
  PAdES seal, immutable retention. Built to prove intent, consent, attribution and integrity
  (US ESIGN/UETA + EU eIDAS SES).
- **Open core** — run it yourself (AGPL-3.0) or use the managed cloud.

## Open vs Cloud

| 🟢 Open source (AGPL-3.0, self-host) | 💰 Penpact Cloud |
|---|---|
| Core engine: documents, fields, signing flow, signed PDF + audit trail, Certificate of Completion, SHA-256 + PAdES seal | Managed hosting (no infra to run) |
| Email-link signer auth | AI field auto-detection · drop-in SDK components |
| Self-host docs | SMS / ID-verification auth, white-label, multi-region, SOC 2, support |

## Quickstart (preview)

```ts
import { PenpactClient } from '@penpact/sdk';

const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });

const envelope = await penpact.createEnvelope({
  documentName: 'NDA',
  signers: [{ name: 'Bob', email: 'bob@example.com' }],
});
await penpact.uploadDocument(envelope.id, pdfBytes);
await penpact.placeFields(envelope.id, [
  { type: 'signature', signerId: envelope.signers[0].id, page: 1, x: 100, y: 600, width: 180, height: 40 },
]);
await penpact.send(envelope.id);
```

### Self-host in minutes

```bash
docker compose up
```

Brings up Postgres + the API, applies migrations, and prints a ready-to-use demo
API key in the logs. Then point the SDK at `http://localhost:3000`:

```ts
const penpact = new PenpactClient({ apiKey: 'pk_live_…', baseUrl: 'http://localhost:3000' });
```

Mint more keys with: `docker compose exec api node apps/api/dist/bin/bootstrap.js you@example.com`

## How it compares

| | Penpact | DocuSign API | Dropbox Sign API | DocuSeal / Documenso |
|---|---|---|---|---|
| Open source | ✅ AGPL-3.0 | ❌ | ❌ | ✅ |
| Embeddable drop-in component | ✅ (planned) | ⚠️ iframe | ⚠️ iframe | ⚠️ |
| AI field detection | ✅ | ⚠️ add-on | ❌ | ❌ |
| Pricing model | usage-based, no seats | per-envelope, seats | per-signature | self-host / SaaS |
| First-class TypeScript SDK | ✅ | ⚠️ | ⚠️ | ⚠️ |

*Comparison reflects public positioning as of 2026; verify current vendor details before relying on it.*

## Repository layout

This is a pnpm + TypeScript monorepo.

```
apps/
  api/          Hono REST API + signing engine (the open core)
  dashboard/    Customer dashboard — keys, usage, billing (Phase 5)
  marketing/    Astro marketing + SEO site (Phase 6)
packages/
  core/         Shared domain model + compliance vocabulary (audit events, statuses)
  db/           Drizzle schema + Postgres client
  sdk/          @penpact/sdk — official typed client
  signing-ui/   Embeddable <Sign/> component (Phase 3)
docs/
```

## Development

```bash
pnpm install
pnpm check        # Biome lint + format check
pnpm typecheck    # tsc project references
pnpm test         # Vitest
pnpm --filter @penpact/api dev   # run the API locally
```

## Roadmap

1. **Core signing engine** (open) — envelopes, fields, email-link auth + consent, append-only event log, SHA-256 + PAdES seal, Certificate of Completion.
2. **Compliance hardening** — §7001(c) consent flow, security (API keys, rate limits, abuse), ToS/privacy/DPA.
3. **Developer DX** — first-class TS SDK, drop-in `<Sign/>` component, < 15-min quickstart.
4. **AI differentiation** — AI field auto-detection (Claude); optional MCP server.
5. **Cloud + billing + OSS launch** — Stripe usage metering, generous free tier, Show HN + Product Hunt.
6. **GTM / SEO** — free signature-maker tool, programmatic long-tail pages, listicles.

## Why AGPL-3.0

The core is AGPL so anyone can self-host, but a company can't ship our code inside a closed
competing product without open-sourcing theirs. Self-hosters are welcome (and become word of mouth);
companies that don't want to run infra use the managed cloud. A separate commercial license is
available — see [`SECURITY.md`](SECURITY.md) for contact.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: please follow [`SECURITY.md`](SECURITY.md).

## License

[AGPL-3.0-only](LICENSE) © Penpact
