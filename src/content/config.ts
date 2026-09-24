import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    /** Deck line under the h1; rendered with the shared .page-subtitle style. */
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    /** Last substantive revision; renders as "Updated <date>" in the post byline. */
    updated: z.coerce.date().optional(),
    description: z.string(),
    tags: z.array(z.string()).optional(),
    series: z.string().optional(),
    /**
     * Position within `series`. Several series posts legitimately share a publish
     * date, so date alone cannot order them; this is the tiebreaker used by the
     * series nav and the archive/tag listings.
     */
    order: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string().optional(),
    year: z.number(),
    order: z.number(),
  }),
});

export const collections = { posts, projects };
