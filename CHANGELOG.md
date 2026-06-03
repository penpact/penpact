# Changelog

All notable changes to Penpact are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [0.1.0] — 2026-06-03

First public preview of the open-source signing engine. **Early development — the API is
not yet stable.**

### Added

- **REST API** (Hono + TypeScript): envelopes (create / get / list / send / void), PDF
  upload + download, field placement, signer signing flow.
- **Signer flow**: token-authorized session, ESIGN §7001(c) consent, complete, decline —
  with a state machine and an **append-only audit trail**.
- **AI field auto-detection** via Claude (`/fields/auto-detect`), graceful when unconfigured.
- **Sealing**: field flattening, **PAdES-B digital signature** (self-signed per-process by
  default; configure a CA certificate via `PENPACT_SIGNING_P12_BASE64` for a trusted chain),
  SHA-256 of original + final, immutable retention, and a generated **Certificate of Completion** PDF.
- **Webhooks**: HMAC-SHA256-signed `envelope.completed` events.
- **Official TypeScript SDK** — `@penpact/sdk`.
- **Postgres schema + migrations** (Drizzle) with a DB-enforced append-only events trigger.
- **Docker quickstart** — `docker compose up` brings up Postgres + the API and prints a
  ready-to-use demo API key.

### Known limitations

- PAdES signing uses a **self-signed** certificate unless you provide a CA-issued one
  (`PENPACT_SIGNING_P12_BASE64`); a self-signed chain is valid but untrusted by viewers.
- The consent disclosure text is a draft pending legal review.
- No hosted cloud yet — self-host via Docker. Email delivery and a dashboard are planned.

[0.1.0]: https://github.com/penpact/penpact/releases/tag/v0.1.0
