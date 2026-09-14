import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { changementStatut, slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Publie ou dépublie. Séparé de l'enregistrement à dessein : publier est un
 * geste dont on doit pouvoir dater et tracer la décision, pas un champ parmi
 * d'autres dans un formulaire qu'on enregistre machinalement.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const { status, publishedAt } = await readValidatedBody(event, changementStatut.parse)
  const db = useBase()

  const [existant] = await db
    .select({ id: article.id, publishedAt: article.publishedAt })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!existant) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  // La contrainte SQL l'exige : publié implique une date. On la fournit
  // plutôt que de laisser PostgreSQL renvoyer une erreur à Max.
  const date =
    status === 'published'
      ? publishedAt
        ? new Date(publishedAt)
        : (existant.publishedAt ?? new Date())
      : existant.publishedAt

  const [maj] = await db
    .update(article)
    .set({ status, publishedAt: date })
    .where(eq(article.id, existant.id))
    .returning({ slug: article.slug, status: article.status, publishedAt: article.publishedAt })

  return maj
})
