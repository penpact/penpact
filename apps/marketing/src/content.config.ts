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

// Blog posts live in ../blog as markdown with frontmatter + embedded JSON-LD,
// rendered at /blog/<slug> by src/pages/blog/[...slug].astro.
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    slug: z.string(),
    excerpt: z.string(),
    author: z.string().default('Penpact Team'),
    publishedAt: z.string(),
    updatedAt: z.string().optional(),
    category: z.string().default('Guide'),
    keywords: z.array(z.string()).optional(),
  }),
});

export const collections = { docs, blog };
