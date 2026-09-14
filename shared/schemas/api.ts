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
