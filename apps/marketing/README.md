# @penpact/marketing

Marketing + SEO site for **penpact.dev**. Astro, static output.

- `src/pages/index.astro` — landing page
- `src/pages/[...slug].astro` — renders the `docs` content collection (the SEO pages in `content/`) at their slugs
- `content/*.md` — the SEO/GEO content pages (frontmatter + embedded JSON-LD)
- `public/` — `favicon.svg`, `og.svg`, `robots.txt`, `llms.txt`
- Sitemap via `@astrojs/sitemap`

## Develop

```bash
pnpm --filter @penpact/marketing dev      # local dev server
pnpm --filter @penpact/marketing build    # static build to dist/
```

## Deploy

Hosted on **Cloudflare Pages** (project `penpact`, served at penpact.dev + www).

```bash
pnpm --filter @penpact/marketing build
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
  npx wrangler pages deploy apps/marketing/dist --project-name penpact --branch main
```

URLs are no-trailing-slash (`build.format: 'file'` + `trailingSlash: 'never'`) to match the
canonical tags. The site is excluded from Biome (Astro files) and from the API Docker build.
