import { desc, eq, inArray } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, media, tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Every article, drafts included. Role `editor` is enough.
 *
 * Carries the cover and the tags, which the list itself does not show: the
 * window that attaches a publication to an article does. Choosing was a
 * matter of reading titles in a column — for a site whose articles are
 * recognised by their artwork, and searched by subject.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const db = useDatabase()

  const rows = await db
    .select({
      id: article.id,
      slug: article.slug,
      title: article.title,
      status: article.status,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      coverUrl: media.url,
    })
    .from(article)
    .leftJoin(media, eq(media.id, article.coverMediaId))
    .orderBy(desc(article.updatedAt))

  // Une seconde requête plutôt qu'une jointure : jointe, la liste renvoie
  // une ligne PAR TAG, et un article à trois tags apparaît trois fois.
  const ids = rows.map((r) => r.id)
  const labels = ids.length
    ? await db
        .select({ articleId: articleTag.articleId, label: tag.label, slug: tag.slug })
        .from(articleTag)
        .innerJoin(tag, eq(tag.id, articleTag.tagId))
        .where(inArray(articleTag.articleId, ids))
    : []

  const byArticle = new Map<number, { label: string; slug: string }[]>()
  for (const t of labels) {
    const list = byArticle.get(t.articleId) ?? []
    list.push({ label: t.label, slug: t.slug })
    byArticle.set(t.articleId, list)
  }

  return rows.map(({ id, ...rest }) => ({ ...rest, tags: byArticle.get(id) ?? [] }))
})
