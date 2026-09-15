import { count, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'

/**
 * Les tags, avec le nombre d'articles publiés qui les portent.
 *
 * Le tri se fait ICI, en JavaScript, et non par un ORDER BY : les images
 * alpine de PostgreSQL n'embarquent pas les locales ICU complètes, et
 * l'ordre des tags changerait selon l'image utilisée. `localeCompare`
 * donne le même résultat partout, et c'est déjà l'ordre qu'affichait la
 * maquette.
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
