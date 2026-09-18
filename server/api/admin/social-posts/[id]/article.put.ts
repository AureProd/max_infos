import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { postLink } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleSocialPost, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Attaches a post to an article, or detaches it.
 *
 * The link is OPTIONAL on both sides: an article may have no variant, a
 * post may exist without an article. Hence a junction table rather than a
 * foreign key.
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

  // Detaching: remove any existing link and stop there.
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
