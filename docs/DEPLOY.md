# Deploying Penpact Cloud

The API ships as a Dockerfile, so any container host works. Below: **Railway** (managed Postgres
+ container) and **Resend** for transactional email. These steps need your own accounts and
provision paid resources — run them yourself.

## 1. API + Postgres on Railway

1. Create a Railway project → **Add Postgres** (managed). Copy its `DATABASE_URL`.
2. **Deploy from GitHub** → select `penpact/penpact`. Railway detects the `Dockerfile` and builds it.
3. Set service **variables**:
   ```
   DATABASE_URL=<from the Railway Postgres plugin>
   PORT=3000
   PUBLIC_BASE_URL=https://api.penpact.dev
   STORAGE_DIR=/data/storage          # or configure R2/S3 (see §3)
   # optional:
   ANTHROPIC_API_KEY=...              # enables AI field auto-detect
   PENPACT_SIGNING_P12_BASE64=...     # CA-issued cert for trusted PAdES (else self-signed)
   PENPACT_SIGNING_P12_PASSPHRASE=...
   RESEND_API_KEY=...                 # enables email (see §2)
   EMAIL_FROM=Penpact <hello@send.penpact.dev>
   ```
4. Add a **volume** mounted at `/data/storage` (so documents persist) — or move to object storage.
5. The container entrypoint runs **migrations** on start, then serves. First boot: bootstrap a key:
   ```
   railway run node apps/api/dist/bin/bootstrap.js you@example.com
   ```
6. **DNS:** add a `CNAME` for `api.penpact.dev` → your Railway domain (in Cloudflare). Railway issues TLS.

## 2. Email (Resend) on `send.penpact.dev`

1. Create a Resend account → add domain **`send.penpact.dev`** (a subdomain, to protect the root
   `penpact.dev` reputation used by Zoho human mail).
2. Add the **SPF / DKIM / (DMARC)** records Resend shows you to Cloudflare under `send.penpact.dev`.
3. Set `RESEND_API_KEY` and `EMAIL_FROM=Penpact <hello@send.penpact.dev>` on the API service.
   Without these, signing still works — invitations are simply not emailed.

## 3. Document storage (production)

Local disk (`STORAGE_DIR`) is fine for a single instance. For durability/multi-instance, point
storage at Cloudflare R2 / S3 (object-lock + versioning for immutable retention) — the `Storage`
interface in `apps/api/src/storage` is the seam; an R2 backend is the next increment.

## 4. Smoke test

```bash
curl https://api.penpact.dev/health        # {"status":"ok"}
# then drive it with @penpact/sdk using the bootstrapped key
```

> Local all-in-one (no cloud): `docker compose up` — see the README.
