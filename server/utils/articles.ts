import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { RESERVED_SLUGS, slugify } from '#shared/utils/slug'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
/*
 * `derivedFields` et `derivedFromMarkdown` vivent dans `markdown.ts`.
 *
 * Elles étaient ici, ce qui est leur place logique — mais le script de
 * semis les appelle, et il tourne sous `tsx`, qui ne connaît pas l'alias
 * `#shared` dont ce fichier dépend. Même raison que le commentaire de
 * `server/database/schema/enums.ts`. Les réexporter d'ici ne marche pas non
 * plus : Nitro auto-importe server/utils, et voit alors deux fois le même
 * nom.
 */

/**
 * Attaches an article to a list of tags, creating the missing ones.
 *
 * Replaces the whole set rather than adding to it: that is what a form
 * where you remove a tag expects. Tags left orphaned are not deleted — they
 * get reused, and erasing them would lose a hand-picked colour.
 */
export async function replaceTags(articleId: number, labels: string[]): Promise<void> {
  const db = useDatabase()
  /*
   * Deduplicated on the SLUG and not on the label: « Géopolitique » and
   * « geopolitique » are the same tag, and keeping both made the loop write
   * the same row twice.
   */
  const bySlug = new Map<string, string>()
  for (const raw of labels) {
    const label = raw.trim()
    if (!label) continue
    const slug = slugify(label)
    if (slug && !bySlug.has(slug)) bySlug.set(slug, label)
  }
  const wanted = [...bySlug.values()]

  if (wanted.length === 0) {
    await db.delete(articleTag).where(eq(articleTag.articleId, articleId))
    return
  }

  const ids: number[] = []
  for (const label of wanted) {
    /*
     * onConflictDoNOTHING, and no longer DoUpdate.
     *
     * A tag row is SHARED by every article carrying it. Updating its label
     * meant that typing « geopolitique » on one article renamed
     * « Géopolitique » everywhere — in the other articles, and in the
     * filter buttons of the home page. The first spelling wins; renaming a
     * tag for good is a deliberate act, not a side effect of a save.
     */
    const slug = slugify(label)
    await db.insert(tag).values({ slug, label }).onConflictDoNothing({ target: tag.slug })

    // DoNothing returns no row on conflict: the existing one is read back.
    const [row] = await db.select({ id: tag.id }).from(tag).where(eq(tag.slug, slug))
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
 * Finds a free slug from a title: `my-title`, then `my-title-2`…
 *
 * Without this, publishing two articles with close titles would throw a
 * constraint violation in Max's face, and he can do nothing about it.
 */
export async function freeSlug(title: string, sauf?: number): Promise<string> {
  const db = useDatabase()
  const raw = slugify(title) || 'article'
  // A reserved slug is shifted straight away: `home` becomes `home-2`,
  // rather than being made unreachable by the back-office routing.
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

/** Deletes the tags that no longer carry any article. */
export async function cleanOrphanTags(): Promise<number> {
  const db = useDatabase()
  const used = db.selectDistinct({ id: articleTag.tagId }).from(articleTag)
  const removed = await db.delete(tag).where(notInArray(tag.id, used)).returning({ id: tag.id })
  return removed.length
}

/** An article's tag identifiers, for the admin API. */
export async function tagsOf(articleId: number) {
  return await useDatabase()
    .select({ slug: tag.slug, label: tag.label })
    .from(articleTag)
    .innerJoin(tag, eq(tag.id, articleTag.tagId))
    .where(eq(articleTag.articleId, articleId))
}

export { inArray }
