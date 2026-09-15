import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Deletes an article. The links (tags, variants, views) go on cascade;
 * social posts and media STAY — they exist independently.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)

  const removed = await useDatabase()
    .delete(article)
    .where(eq(article.slug, slug))
    .returning({ slug: article.slug })

  if (removed.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }
  return { ok: true as const }
})
