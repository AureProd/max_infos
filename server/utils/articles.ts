import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { RESERVED_SLUGS, slugify } from '#shared/utils/slug'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
import { countCharacters, readingMinutes, renderMarkdown } from './markdown'

/**
 * Rattache un article à une list de tags, en créant ceux qui manquent.
 *
 * Remplace l'ensemble plutôt que d'add : c'est ce qu'attend un
 * formulaire où l'on retire un tag. Les tags devenus orphans ne sont
 * pas supprimés — ils resservent, et les effacer ferait disparaître une
 * color choisie à la main.
 */
export async function replaceTags(articleId: number, labels: string[]): Promise<void> {
  const db = useDatabase()
  const wanted = [...new Set(labels.map((l) => l.trim()).filter(Boolean))]

  if (wanted.length === 0) {
    await db.delete(articleTag).where(eq(articleTag.articleId, articleId))
    return
  }

  const ids: number[] = []
  for (const label of wanted) {
    const [row] = await db
      .insert(tag)
      .values({ slug: slugify(label), label: label })
      .onConflictDoUpdate({ target: tag.slug, set: { label: label } })
      .returning({ id: tag.id })
    if (row) ids.push(row.id)
  }

  await db
    .delete(articleTag)
    .where(and(eq(articleTag.articleId, articleId), notInArray(articleTag.tagId, ids)))

  for (const tagId of ids) {
    await db.insert(articleTag).values({ articleId, tagId }).onConflictDoNothing()
  }
}

/**
 * Les fields dérivés du body, recalculés à chaque record.
 *
 * Le HTML est rendered ICI et nulle part ailleurs : c'est ce qui garantit que
 * rien de non assaini n'entre en base.
 */
export function derivedFields(bodyMd: string) {
  return {
    bodyHtml: renderMarkdown(bodyMd),
    charCount: countCharacters(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  }
}

/**
 * Trouve un slug libre à partir d'un title : `mon-title`, then `mon-title-2`…
 *
 * Sans cela, publier two articles au title proche renverrait une violation
 * de contrainte à la figure de Max, qui n'y peut rien.
 */
export async function freeSlug(title: string, sauf?: number): Promise<string> {
  const db = useDatabase()
  const raw = slugify(title) || 'article'
  // Un slug réservé est décalé d'emblée : `accueil` devient `accueil-2`,
  // plutôt que d'être rendered inaccessible par le routage du back-office.
  const base = (RESERVED_SLUGS as readonly string[]).includes(raw) ? `${raw}-2` : raw
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const [pris] = await db
      .select({ id: article.id })
      .from(article)
      .where(eq(article.slug, candidate))
      .limit(1)
    if (!pris || pris.id === sauf) return candidate
  }
  return `${base}-${Date.now()}`
}

/** Supprime les tags qui ne portent plus aucun article. */
export async function cleanOrphanTags(): Promise<number> {
  const db = useDatabase()
  const used = db.selectDistinct({ id: articleTag.tagId }).from(articleTag)
  const removed = await db.delete(tag).where(notInArray(tag.id, used)).returning({ id: tag.id })
  return removed.length
}

/** Les identifiants de tags d'un article, pour l'API d'administration. */
export async function tagsOf(articleId: number) {
  return await useDatabase()
    .select({ slug: tag.slug, label: tag.label })
    .from(articleTag)
    .innerJoin(tag, eq(tag.id, articleTag.tagId))
    .where(eq(articleTag.articleId, articleId))
}

export { inArray }
