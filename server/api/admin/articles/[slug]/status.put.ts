import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam, statusChange } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Publie ou dépublie. Séparé de l'record à dessein : publier est un
 * geste dont on doit pouvoir dater et tracer la décision, pas un field parmi
 * d'autres dans un formulaire qu'on enregistre machinalement.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const { status, publishedAt } = await readValidatedBody(event, statusChange.parse)
  const db = useDatabase()

  const [existing] = await db
    .select({ id: article.id, publishedAt: article.publishedAt })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  // La contrainte SQL l'exige : publié implique une date. On la fournit
  // plutôt que de laisser PostgreSQL renvoyer une error à Max.
  const date =
    status === 'published'
      ? publishedAt
        ? new Date(publishedAt)
        : (existing.publishedAt ?? new Date())
      : existing.publishedAt

  const [update] = await db
    .update(article)
    .set({ status, publishedAt: date })
    .where(eq(article.id, existing.id))
    .returning({ slug: article.slug, status: article.status, publishedAt: article.publishedAt })

  return update
})
