import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { listArticlesQuery } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, media, tag } from '~~/server/database/schema'
import { day } from '~~/server/utils/serialize'

/**
 * Paginated list of published articles.
 *
 * Filtering happens in SQL and not in memory: that is the direct gain of
 * moving to a database, and the only way this holds up as the article count
 * grows.
 */
export default defineEventHandler(async (event) => {
  const { tag: tagSlug, q, page, size } = await getValidatedQuery(event, listArticlesQuery.parse)
  const db = useDatabase()

  const conditions = [eq(article.status, 'published')]

  if (tagSlug) {
    // A subquery rather than a join: a join would duplicate the rows of an
    // article carrying several tags, and skew the total.
    const ids = db
      .select({ id: articleTag.articleId })
      .from(articleTag)
      .innerJoin(tag, eq(tag.id, articleTag.tagId))
      .where(eq(tag.slug, tagSlug))
    conditions.push(inArray(article.id, ids))
  }

  if (q) {
    const pattern = `%${q}%`
    conditions.push(
      or(
        ilike(article.title, pattern),
        ilike(article.dek, pattern),
        ilike(article.bodyMd, pattern),
      ) ?? eq(article.id, article.id),
    )
  }

  const where = and(...conditions)

  const [total] = await db.select({ n: count() }).from(article).where(where)

  const lines = await db
    .select({
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      publishedAt: article.publishedAt,
      readingMinutes: article.readingMinutes,
      charCount: article.charCount,
      featured: article.featured,
      coverUrl: media.url,
      coverAlt: media.alt,
    })
    .from(article)
    .leftJoin(media, eq(media.id, article.coverMediaId))
    .where(where)
    .orderBy(desc(article.publishedAt))
    .limit(size)
    .offset((page - 1) * size)

  const slugs = lines.map((l) => l.slug)
  const tags = slugs.length
    ? await db
        .select({ slug: article.slug, label: tag.label, tagSlug: tag.slug })
        .from(articleTag)
        .innerJoin(article, eq(article.id, articleTag.articleId))
        .innerJoin(tag, eq(tag.id, articleTag.tagId))
        .where(inArray(article.slug, slugs))
    : []

  return {
    items: lines.map((l) => ({
      ...l,
      publishedAt: day(l.publishedAt),
      tags: tags.filter((s) => s.slug === l.slug).map((s) => ({ slug: s.tagSlug, label: s.label })),
    })),
    total: total?.n ?? 0,
    page,
    size,
  }
})
