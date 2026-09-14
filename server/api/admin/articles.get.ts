import { desc } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/** Tous les articles, brouillons compris. Rôle `editor` suffisant. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  return await useBase()
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
