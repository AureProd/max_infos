import { and, count, eq } from 'drizzle-orm'
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
    /*
     * The published-status test belongs in the ON, not in the WHERE.
     *
     * In the WHERE it turned this LEFT JOIN into an INNER JOIN — an unmatched
     * row has article.status NULL, and NULL = 'published' is not true — so a
     * tag carried only by drafts DISAPPEARED from the list instead of coming
     * back with n = 0.
     */
    .leftJoin(article, and(eq(article.id, articleTag.articleId), eq(article.status, 'published')))
    .groupBy(tag.id, tag.slug, tag.label, tag.color)

  return lines.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
