import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { tagsOf } from '~~/server/utils/articles'
import { requireRole } from '~~/server/utils/auth'

/** Un article, draft compris. */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)

  const [trouve] = await useDatabase().select().from(article).where(eq(article.slug, slug)).limit(1)
  if (!trouve) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  return { ...trouve, tags: await tagsOf(trouve.id) }
})
