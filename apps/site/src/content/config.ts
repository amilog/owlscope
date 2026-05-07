import { defineCollection, z } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ schema: docsSchema() }),
  blog: defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      author: z.string(),
      authorUrl: z.string().url().optional(),
      heroImage: z.string().optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
    }),
  }),
};
