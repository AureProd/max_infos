import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm'
import { listeArticlesQuery } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article, articleTag, media, tag } from '~~/server/database/schema'
import { jour } from '~~/server/utils/serialize'

/**
 * Liste paginée des articles publiés.
 *
 * Le filtrage se fait en SQL et non en mémoire : c'est le gain direct du
 * passage en base, et la seule façon que cela tienne quand le nombre
 * d'articles grandira.
 */
export default defineEventHandler(async (event) => {
  const { tag: sujet, q, page, taille } = await getValidatedQuery(event, listeArticlesQuery.parse)
  const db = useBase()

  const conditions = [eq(article.status, 'published')]

  if (sujet) {
    // Sous-requête plutôt que jointure : une jointure dupliquerait les
    // lignes d'un article portant plusieurs sujets, et fausserait le total.
    const ids = db
      .select({ id: articleTag.articleId })
      .from(articleTag)
      .innerJoin(tag, eq(tag.id, articleTag.tagId))
      .where(eq(tag.slug, sujet))
    conditions.push(inArray(article.id, ids))
  }

  if (q) {
    const motif = `%${q}%`
    conditions.push(
      or(ilike(article.title, motif), ilike(article.dek, motif), ilike(article.bodyMd, motif)) ??
        eq(article.id, article.id),
    )
  }

  const where = and(...conditions)

  const [total] = await db.select({ n: count() }).from(article).where(where)

  const lignes = await db
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
    .limit(taille)
    .offset((page - 1) * taille)

  const slugs = lignes.map((l) => l.slug)
  const sujets = slugs.length
    ? await db
        .select({ slug: article.slug, label: tag.label, tagSlug: tag.slug })
        .from(articleTag)
        .innerJoin(article, eq(article.id, articleTag.articleId))
        .innerJoin(tag, eq(tag.id, articleTag.tagId))
        .where(inArray(article.slug, slugs))
    : []

  return {
    items: lignes.map((l) => ({
      ...l,
      publishedAt: jour(l.publishedAt),
      tags: sujets
        .filter((s) => s.slug === l.slug)
        .map((s) => ({ slug: s.tagSlug, label: s.label })),
    })),
    total: total?.n ?? 0,
    page,
    taille,
  }
})
