import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { RESERVED_SLUGS, slugify } from '#shared/utils/slug'
import { useDatabase } from '~~/server/database/client'
import { article, articleTag, tag } from '~~/server/database/schema'
import { countCharacters, readingMinutes, renderMarkdown } from './markdown'

/**
 * Attaches an article to a list of tags, creating the missing ones.
 *
 * Replaces the whole set rather than adding to it: that is what a form
 * where you remove a tag expects. Tags left orphaned are not deleted — they
 * get reused, and erasing them would lose a hand-picked colour.
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
 * The fields derived from the body, recomputed on every save.
 *
 * The HTML is rendered HERE and nowhere else: that is what guarantees no
 * unsanitised markup ever enters the database.
 */
export function derivedFields(bodyMd: string) {
  return {
    bodyHtml: renderMarkdown(bodyMd),
    charCount: countCharacters(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
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
