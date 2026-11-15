import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// O CMS pode salvar campos opcionais apagados como string vazia ou null.
const optionalText = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.string().min(1).optional(),
)
const optionalDate = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.coerce.date().optional(),
)

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: optionalText,
    pubDate: z.coerce.date(),
    updatedDate: optionalDate,
    draft: z.boolean().optional(),
    // Higher numbers stay above other pinned posts. Omit or use 0 to leave a post in date order.
    pin: z.number().int().min(0).max(99).optional().default(0),
    category: optionalText,
    tags: z.array(z.string().min(1)).default([]),
  }),
})

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().optional(),
    draft: z.boolean().optional(),
  }),
})

export const collections = { blog, pages }
