import { asc, count, eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/** Tous les sujets, avec le nombre d'articles — brouillons compris. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  const lignes = await useBase()
    .select({ slug: tag.slug, label: tag.label, color: tag.color, n: count(article.id) })
    .from(tag)
    .leftJoin(articleTag, eq(articleTag.tagId, tag.id))
    .leftJoin(article, eq(article.id, articleTag.articleId))
    .groupBy(tag.id, tag.slug, tag.label, tag.color)
    .orderBy(asc(tag.label))

  return lignes.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
