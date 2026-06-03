import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

// The SEO content pages live in ../content as markdown with frontmatter and
// embedded JSON-LD. Loaded here as the "docs" collection and rendered at their
// own slugs by src/pages/[...slug].astro.
const docs = defineCollection({
  loader: glob({ pattern: '*.md', base: './content' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    author: z.string().optional(),
    publishedAt: z.string().optional(),
    updatedAt: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
});

export const collections = { docs };
