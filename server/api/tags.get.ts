import { count, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'

/**
 * The tags, with the count of published articles carrying them.
 *
 * Sorting happens HERE, in JavaScript, and not through an ORDER BY: the
 * alpine PostgreSQL images do not ship the full ICU locales, and the order
 * of tags would change with the image used. `localeCompare` gives the same
 * result everywhere, and it is already the order the mock-up displayed.
 */
export default defineEventHandler(async () => {
  const db = useDatabase()

  const lines = await db
    .select({ slug: tag.slug, label: tag.label, color: tag.color, n: count(article.id) })
    .from(tag)
    .leftJoin(articleTag, eq(articleTag.tagId, tag.id))
    .leftJoin(article, eq(article.id, articleTag.articleId))
    .where(eq(article.status, 'published'))
    .groupBy(tag.id, tag.slug, tag.label, tag.color)

  return lines.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
