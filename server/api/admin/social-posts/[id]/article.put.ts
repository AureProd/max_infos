import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { postLink } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleSocialPost, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Rattache une publication à un article, ou la détache.
 *
 * Le link est FACULTATIF des two côtés : un article peut n'avoir aucune
 * déclinaison, une publication peut exister sans article. D'où une table de
 * jonction et non une clé étrangère.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )
  const { articleSlug } = await readValidatedBody(event, postLink.parse)
  const db = useDatabase()

  const [pub] = await db
    .select({ id: socialPost.id })
    .from(socialPost)
    .where(eq(socialPost.id, id))
    .limit(1)
  if (!pub) throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })

  // Détacher : on retire toute liaison existante et on s'arrête.
  await db.delete(articleSocialPost).where(eq(articleSocialPost.socialPostId, id))
  if (!articleSlug) return { linked: null }

  const [art] = await db
    .select({ id: article.id, slug: article.slug })
    .from(article)
    .where(eq(article.slug, articleSlug))
    .limit(1)
  if (!art) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  await db
    .insert(articleSocialPost)
    .values({ articleId: art.id, socialPostId: id })
    .onConflictDoNothing()

  return { linked: art.slug }
})
