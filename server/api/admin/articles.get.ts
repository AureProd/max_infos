import { desc } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/** Every article, drafts included. Role `editor` is enough. */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  return await useDatabase()
    .select({
      slug: article.slug,
      title: article.title,
      status: article.status,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .orderBy(desc(article.updatedAt))
})
