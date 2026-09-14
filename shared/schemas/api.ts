import { z } from 'zod'

/**
 * Validation des entrées HTTP publiques.
 *
 * Le même schéma produit le type TypeScript : il n'y a pas deux endroits à
 * tenir. C'est l'équivalent exact de ce que faisait Pydantic.
 */

export const TAILLE_PAGE_DEFAUT = 12

export const listeArticlesQuery = z.object({
  /** Filtre sur le slug d'un sujet. */
  tag: z.string().trim().min(1).max(80).optional(),
  /** Recherche libre dans le titre, le chapô et le corps. */
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  taille: z.coerce.number().int().min(1).max(50).default(TAILLE_PAGE_DEFAUT),
})

export type ListeArticlesQuery = z.infer<typeof listeArticlesQuery>

export const listeSocialQuery = z.object({
  network: z.enum(['instagram', 'linkedin']).optional(),
  /** Un article donné : ses déclinaisons. */
  article: z.string().trim().min(1).max(200).optional(),
})

export type ListeSocialQuery = z.infer<typeof listeSocialQuery>

/** Le slug d'un article, tel qu'il apparaît dans l'URL. */
export const slugParam = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide')

// ---------------------------------------------------------------------------
// Back-office

export const brouillonArticle = z.object({
  title: z.string().trim().min(1).max(300),
  dek: z.string().trim().max(600).nullable().optional(),
  bodyMd: z.string().max(500_000).default(''),
  /** Slugs de sujets. Les inconnus sont créés. */
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  coverMediaId: z.number().int().positive().nullable().optional(),
  seoTitle: z.string().trim().max(300).nullable().optional(),
  seoDescription: z.string().trim().max(600).nullable().optional(),
  substackUrl: z.string().trim().url().max(600).nullable().optional(),
  featured: z.boolean().default(false),
})

export type BrouillonArticle = z.infer<typeof brouillonArticle>

/** Création : le slug est proposé, ou déduit du titre. */
export const creationArticle = brouillonArticle.extend({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200)
    .optional(),
})

export const changementStatut = z.object({
  status: z.enum(['draft', 'published']),
  /** Publication différée. Absent = maintenant. */
  publishedAt: z.string().datetime().nullable().optional(),
})

export const demandeTeleversement = z.object({
  filename: z.string().trim().min(1).max(300),
  contentType: z.string().trim().min(1).max(200),
  bytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  alt: z.string().trim().max(600).optional(),
})

export const apercuMarkdown = z.object({
  bodyMd: z.string().max(500_000),
})

// ---------------------------------------------------------------------------
// Déclinaisons sociales (lot 7)

/**
 * Saisie manuelle d'une publication.
 *
 * LinkedIn est saisi à la main par nécessité : le scope `r_member_social`
 * est fermé aux nouvelles applications, la découverte automatique est donc
 * hors de portée. Instagram peut l'être aussi, pour une publication qui
 * précéderait la connexion de l'API.
 */
export const publicationManuelle = z.object({
  network: z.enum(['instagram', 'linkedin']),
  url: z.string().trim().url().max(600),
  caption: z.string().trim().max(4000).optional(),
  postedAt: z.string().date().optional(),
  mediaType: z.enum(['reel', 'carousel', 'image', 'post']).optional(),
})

export const liaisonPublication = z.object({
  articleSlug: z.string().trim().min(1).max(200).nullable(),
})

export const visibilitePublication = z.object({
  hidden: z.boolean(),
})

/**
 * L'affichage d'un compte sur l'accueil.
 *
 * Tout est facultatif : l'écran envoie le seul champ qu'on vient de toucher
 * — une flèche ↑, un interrupteur — plutôt que de renvoyer l'état entier et
 * risquer d'écraser un réglage modifié entre-temps.
 *
 * L'identité du compte (nom, photo, bio) n'est PAS ici : elle vient
 * d'Instagram et ne se saisit pas.
 */
export const affichageCompte = z.object({
  visible: z.boolean().optional(),
  position: z.number().int().min(0).max(100).optional(),
  postsOnHome: z.number().int().min(1).max(50).optional(),
})

/**
 * Gabarits de déclinaison, éditables par Max.
 *
 * Les variables sont résolues à partir de l'article : {{titre}}, {{chapo}},
 * {{url}}, {{sujets}}, {{minutes}}.
 */
export const gabarits = z.object({
  linkedin: z.string().max(8000),
  reel: z.string().max(8000),
})
