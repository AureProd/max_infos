import { count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/database/client'
import { articleTag, tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Deletes a subject NO article carries.
 *
 * Every misspelling created one more tag and nothing ever removed it: the
 * list of « déjà utilisés » grew with the mistakes, with no way back.
 *
 * The count is read here rather than trusted from the screen: a tag freed
 * on one browser while another still shows it as orphaned would otherwise
 * be stripped off the articles carrying it, silently. Hence 409 rather than
 * a cascade — refusing is the only answer that loses nothing.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const { slug } = await getValidatedRouterParams(
    event,
    z.object({ slug: z.string().trim().min(1) }).parse,
  )

  const db = useDatabase()
  const [found] = await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug))
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Sujet introuvable' })

  const [used] = await db
    .select({ n: count() })
    .from(articleTag)
    .where(eq(articleTag.tagId, found.id))

  if ((used?.n ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ce sujet est encore porté par ${used?.n} article(s).`,
    })
  }

  await db.delete(tag).where(eq(tag.id, found.id))
  return { deleted: slug }
})
