import { z } from 'zod'

/**
 * Validation des entrées HTTP publicOnes.
 *
 * Le même schéma produit le type TypeScript : il n'y a pas two endroits à
 * tenir. C'est l'équivalent exact de ce que faisait Pydantic.
 */

export const DEFAULT_PAGE_SIZE = 12

export const listArticlesQuery = z.object({
  /** Filtre sur le slug d'un sujet. */
  tag: z.string().trim().min(1).max(80).optional(),
  /** Recherche libre dans le titre, le chapô et le body. */
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  taille: z.coerce.number().int().min(1).max(50).default(DEFAULT_PAGE_SIZE),
})

export type ListArticlesQuery = z.infer<typeof listArticlesQuery>

export const listSocialQuery = z.object({
  network: z.enum(['instagram', 'linkedin']).optional(),
  /** Un article donné : ses déclinaisons. */
  article: z.string().trim().min(1).max(200).optional(),
})

export type ListSocialQuery = z.infer<typeof listSocialQuery>

/** Le slug d'un article, tel qu'il apparaît dans l'URL. */
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
  /** Slugs de tags. Les inconnus sont créés. */
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  coverMediaId: z.number().int().positive().nullable().optional(),
  seoTitle: z.string().trim().max(300).nullable().optional(),
  seoDescription: z.string().trim().max(600).nullable().optional(),
  substackUrl: z.string().trim().url().max(600).nullable().optional(),
  featured: z.boolean().default(false),
})

export type ArticleDraft = z.infer<typeof articleDraft>

/** Création : le slug est proposé, ou déduit du titre. */
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
  /** Publication différée. Absent = maintenant. */
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
// Déclinaisons sociales (lot 7)

/**
 * Saisie manuelle d'une publication.
 *
 * LinkedIn est saisi à la main par nécessité : le scope `r_member_social`
 * est fermé aux fresh applications, la découverte automatique est donc
 * hors de portée. Instagram peut l'être aussi, pour une publication qui
 * précéderait la connection de l'API.
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
 * L'affichage d'un account sur l'accueil.
 *
 * Tout est facultatif : l'écran envoie le seul champ qu'on vient de toucher
 * — une flèche ↑, un interrupteur — plutôt que de renvoyer l'état entier et
 * risquer d'écraser un réglage modifié entre-temps.
 *
 * L'identité du account (name, photo, bio) n'est PAS here : elle vient
 * d'Instagram et ne se saisit pas.
 */
export const accountLabel = z.object({
  visible: z.boolean().optional(),
  position: z.number().int().min(0).max(100).optional(),
  postsOnHome: z.number().int().min(1).max(50).optional(),
})

/**
 * Gabarits de déclinaison, éditables par Max.
 *
 * Les variables sont résolues à partir de l'article : {{titre}}, {{chapo}},
 * {{url}}, {{tags}}, {{minutes}}.
 */
export const templates = z.object({
  linkedin: z.string().max(8000),
  reel: z.string().max(8000),
})
