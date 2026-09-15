import { asc, count, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/** Tous les tags, avec le count d'articles — brouillons compris. */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const lines = await useDatabase()
    .select({ slug: tag.slug, label: tag.label, color: tag.color, n: count(article.id) })
    .from(tag)
    .leftJoin(articleTag, eq(articleTag.tagId, tag.id))
    .leftJoin(article, eq(article.id, articleTag.articleId))
    .groupBy(tag.id, tag.slug, tag.label, tag.color)
    .orderBy(asc(tag.label))

  return lines.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
