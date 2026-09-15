import { z } from 'zod'

/**
 * Validation of public HTTP input.
 *
 * The same schema produces the TypeScript type: there are not two places to
 * keep in sync. This is the exact equivalent of what Pydantic used to do.
 */

export const DEFAULT_PAGE_SIZE = 12

export const listArticlesQuery = z.object({
  /** Filter on a tag slug. */
  tag: z.string().trim().min(1).max(80).optional(),
  /** Free-text search across title, dek and body. */
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  size: z.coerce.number().int().min(1).max(50).default(DEFAULT_PAGE_SIZE),
})

export type ListArticlesQuery = z.infer<typeof listArticlesQuery>

export const listSocialQuery = z.object({
  network: z.enum(['instagram', 'linkedin']).optional(),
  /** A given article: its variants. */
  article: z.string().trim().min(1).max(200).optional(),
})

export type ListSocialQuery = z.infer<typeof listSocialQuery>

/** An article slug, as it appears in the URL. */
export const slugParam = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')

// ---------------------------------------------------------------------------
// Back-office

export const articleDraft = z.object({
  title: z.string().trim().min(1).max(300),
  dek: z.string().trim().max(600).nullable().optional(),
  bodyMd: z.string().max(500_000).default(''),
  /** Tag slugs. Unknown ones are created. */
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  coverMediaId: z.number().int().positive().nullable().optional(),
  seoTitle: z.string().trim().max(300).nullable().optional(),
  seoDescription: z.string().trim().max(600).nullable().optional(),
  substackUrl: z.string().trim().url().max(600).nullable().optional(),
  featured: z.boolean().default(false),
})

export type ArticleDraft = z.infer<typeof articleDraft>

/** Creation: the slug is supplied, or derived from the title. */
export const articleCreation = articleDraft.extend({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200)
    .optional(),
})

export const statusChange = z.object({
  status: z.enum(['draft', 'published']),
  /** Deferred publication. Absent = now. */
  publishedAt: z.string().datetime().nullable().optional(),
})

export const uploadRequest = z.object({
  filename: z.string().trim().min(1).max(300),
  contentType: z.string().trim().min(1).max(200),
  bytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  alt: z.string().trim().max(600).optional(),
})

export const previewMarkdown = z.object({
  bodyMd: z.string().max(500_000),
})

// ---------------------------------------------------------------------------
// Social variants (lot 7)

/**
 * Manual entry of a post.
 *
 * LinkedIn is entered by hand out of necessity: the `r_member_social` scope
 * is closed to new applications, so automatic discovery is out of reach.
 * Instagram may be entered by hand too, for a post that predates the API
 * connection.
 */
export const manualPost = z.object({
  network: z.enum(['instagram', 'linkedin']),
  url: z.string().trim().url().max(600),
  caption: z.string().trim().max(4000).optional(),
  postedAt: z.string().date().optional(),
  mediaType: z.enum(['reel', 'carousel', 'image', 'post']).optional(),
})

export const postLink = z.object({
  articleSlug: z.string().trim().min(1).max(200).nullable(),
})

export const postVisibility = z.object({
  hidden: z.boolean(),
})

/**
 * How an account shows up on the home page.
 *
 * Everything is optional: the screen sends only the field just touched — an
 * ↑ arrow, a switch — rather than posting the whole state back and risking
 * overwriting a setting changed in the meantime.
 *
 * The account identity (name, picture, bio) is NOT here: it comes from
 * Instagram and is not entered by hand.
 */
export const accountLabel = z.object({
  visible: z.boolean().optional(),
  position: z.number().int().min(0).max(100).optional(),
  postsOnHome: z.number().int().min(1).max(50).optional(),
})

/**
 * Variant templates, editable by Max.
 *
 * Variables are resolved from the article: {{title}}, {{dek}}, {{url}},
 * {{tags}}, {{minutes}}. Their names stay French — Max writes them.
 */
export const templates = z.object({
  linkedin: z.string().max(8000),
  reel: z.string().max(8000),
})
