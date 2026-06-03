// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Static marketing site for penpact.dev. Built to ./dist, deployed as static
// files (Cloudflare Pages / any static host). The API lives at api.penpact.dev.
export default defineConfig({
  site: 'https://penpact.dev',
  output: 'static',
  // Clean, no-trailing-slash URLs that match the canonical tags (emits
  // <slug>.html served at /<slug> on Cloudflare Pages, no 308 redirect hop).
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap()],
  // The content pages embed JSON-LD <script> blocks in markdown; keep raw HTML.
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});
