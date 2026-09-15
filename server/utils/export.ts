import { asc, eq, sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import {
  appUser,
  article,
  articleSocialPost,
  articleTag,
  articleView,
  media,
  setting,
  socialAccount,
  socialPost,
  tag,
} from '~~/server/database/schema'

/**
 * Full site export, as data.
 *
 * What is NOT exported, deliberately:
 *  - the `secret` table, which holds nothing but encrypted third-party
 *    tokens. Re-exporting them would mean taking access credentials out of
 *    a system to put them in a file about to be downloaded;
 *  - the FILES themselves, which live in R2. That is the whole point of
 *    having moved them out: the archive carries only references, and stays
 *    light.
 *
 * Schema version up front: an import can then say it cannot read a newer
 * archive, instead of writing nonsense.
 */
/**
 * 2: the archive now carries `social_account`. Without it, restoring onto a
 * blank database would fail, `social_post.account_id` pointing at accounts
 * that do not exist.
 */
export const SCHEMA_VERSION = 2

export interface Archive {
  manifest: {
    version: number
    exportedAt: string
    counts: Record<string, number>
  }
  articles: unknown[]
  tags: unknown[]
  tagLinks: unknown[]
  media: unknown[]
  socialAccounts: unknown[]
  socialPosts: unknown[]
  socialLinks: unknown[]
  settings: unknown[]
  users: unknown[]
  views: unknown[]
}

export async function buildExport(): Promise<Archive> {
  const db = useDatabase()

  const [
    articles,
    tags,
    tagLinks,
    mediaItems,
    socialAccountRows,
    publications,
    socialLinks,
    settings,
    accounts,
    views,
  ] = await Promise.all([
    db.select().from(article).orderBy(asc(article.slug)),
    db.select().from(tag).orderBy(asc(tag.slug)),
    db.select().from(articleTag),
    db.select().from(media).orderBy(asc(media.id)),
    db.select().from(socialAccount).orderBy(asc(socialAccount.id)),
    db.select().from(socialPost).orderBy(asc(socialPost.id)),
    db.select().from(articleSocialPost),
    db.select().from(setting).orderBy(asc(setting.key)),
    // The role and the address, nothing more: there is nothing else worth
    // exporting from an account, and certainly no way to sign in as it.
    db
      .select({
        email: appUser.email,
        name: appUser.name,
        role: appUser.role,
        active: appUser.active,
      })
      .from(appUser)
      .orderBy(asc(appUser.email)),
    db.select().from(articleView),
  ])

  return {
    manifest: {
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      counts: {
        articles: articles.length,
        tags: tags.length,
        media: mediaItems.length,
        socialAccounts: socialAccountRows.length,
        socialPosts: publications.length,
        settings: settings.length,
        users: accounts.length,
        views: views.length,
      },
    },
    articles,
    tags: tags,
    tagLinks,
    media: mediaItems,
    socialAccounts: socialAccountRows,
    socialPosts: publications,
    socialLinks,
    settings: settings,
    users: accounts,
    views: views,
  }
}

/** An article's YAML front matter, for the archive's readability. */
export function articleToMarkdown(a: Record<string, unknown>, tags: string[]): string {
  // The BACKSLASH first, then the quote: doing it the other way round would
  // double the backslashes just added, and a title ending in one would
  // escape the closing quote and swallow the following line of front matter.
  const escaped = (v: unknown): string =>
    `"${String(v ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')}"`
  return `---
slug: ${escaped(a.slug)}
title: ${escaped(a.title)}
dek: ${escaped(a.dek)}
status: ${escaped(a.status)}
publishedAt: ${escaped(a.publishedAt instanceof Date ? a.publishedAt.toISOString() : a.publishedAt)}
tags: [${tags.map(escaped).join(', ')}]
substackUrl: ${escaped(a.substackUrl)}
---

${a.bodyMd ?? ''}
`
}

/**
 * Rewrites the database from an archive.
 *
 * `secret` is never touched: an import must not be able to replace the
 * access tokens of third-party accounts.
 */
export async function applyImport(
  archive: Archive,
  options: { wipe: boolean },
): Promise<Record<string, number>> {
  const db = useDatabase()

  if (archive.manifest?.version !== SCHEMA_VERSION) {
    throw createError({
      statusCode: 422,
      statusMessage: `Archive de version ${archive.manifest?.version}, attendue ${SCHEMA_VERSION}`,
    })
  }

  if (options.wipe) {
    // `secret` is ABSENT from this list, on purpose: an import must not be
    // able to erase the access tokens of third-party accounts.
    await db.execute(sql`truncate table
      article_view, article_social_post, article_tag, social_post,
      social_account, article, tag, media, setting, app_user
      restart identity cascade`)
  }

  /**
   * Dates cross the archive as ISO strings; Drizzle expects Date objects.
   * Without this conversion, the insert fails on every timestamp.
   */
  const DATE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'publishedAt',
    'postedAt',
    'lastLoginAt',
    'lastSyncAt',
  ])

  const replay = <T>(lines: T[]): T[] =>
    (lines ?? []).map((row) => {
      const copied = { ...(row as Record<string, unknown>) }
      for (const [key, value] of Object.entries(copied)) {
        if (DATE_FIELDS.has(key) && typeof value === 'string') copied[key] = new Date(value)
      }
      return copied as T
    })

  const written: Record<string, number> = {}

  const insert = async <T>(name: string, table: never, lines: T[]): Promise<void> => {
    if (!lines?.length) {
      written[name] = 0
      return
    }
    await db
      .insert(table)
      .values(replay(lines) as never)
      .onConflictDoNothing()
    written[name] = lines.length
  }

  // The order follows the dependencies: whatever is referenced comes first.
  await insert('users', appUser as never, archive.users as never[])
  await insert('media', media as never, archive.media as never[])
  await insert('tags', tag as never, archive.tags as never[])
  await insert('articles', article as never, archive.articles as never[])
  // Accounts BEFORE posts: the latter reference the former.
  await insert('socialAccounts', socialAccount as never, archive.socialAccounts as never[])
  await insert('socialPosts', socialPost as never, archive.socialPosts as never[])
  await insert('tagLinks', articleTag as never, archive.tagLinks as never[])
  await insert('socialLinks', articleSocialPost as never, archive.socialLinks as never[])
  await insert('settings', setting as never, archive.settings as never[])
  await insert('views', articleView as never, archive.views as never[])

  /**
   * Moves the sequences past the highest imported identifier.
   *
   * Without this, the next creation would restart at 1 and collide with a
   * restored row — a failure that would only surface on the first article
   * written AFTER the import, long after the operation was believed to have
   * succeeded.
   */
  for (const table of ['article', 'tag', 'media', 'social_account', 'social_post', 'app_user']) {
    await db.execute(
      sql`select setval(
        pg_get_serial_sequence(${table}, 'id'),
        coalesce((select max(id) from ${sql.identifier(table)}), 0) + 1,
        false
      )`,
    )
  }

  return written
}

export { eq }
