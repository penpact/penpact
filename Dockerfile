# syntax=docker/dockerfile:1

# ── base ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@10
WORKDIR /app

# ── build (install + compile TypeScript) ───────────────────────────────────
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Build only the API and its workspace dependencies (not the marketing site).
RUN pnpm --filter "@penpact/api..." build

# ── runner ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Copy the whole workspace (preserves pnpm's node_modules symlinks + drizzle migrations).
COPY --from=build /app /app
EXPOSE 3000

# On start: apply migrations, optionally mint a demo API key, then serve.
CMD ["sh", "-lc", "node apps/api/dist/bin/migrate.js && { [ -n \"$DEMO_BOOTSTRAP_EMAIL\" ] && node apps/api/dist/bin/bootstrap.js \"$DEMO_BOOTSTRAP_EMAIL\" || true; } && node apps/api/dist/index.js"]
