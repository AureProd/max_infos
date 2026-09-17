import { asc, eq, sql } from 'drizzle-orm'
import { strFromU8, unzipSync } from 'fflate'
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

/**
 * Reads back the ZIP the site hands out.
 *
 * The export produced an archive and the import accepted nothing but raw
 * JSON: the backup downloaded from the Technique screen could not be
 * restored with it, and pulling production content into a local database
 * was simply impossible.
 *
 * The layout read here is the one `export.get.ts` writes. The root folder
 * carries the day of the export, so it is FOUND rather than assumed — a
 * pinned name would only ever restore today's backup. The .md files are
 * ignored: they are there for humans, the JSON is what restores.
 */
export function archiveFromZip(bytes: Uint8Array): Archive {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw createError({ statusCode: 422, statusMessage: "Ce fichier n'est pas une archive zip" })
  }

  const manifestPath = Object.keys(files).find(
    (f) => f.endsWith('manifest.json') && !f.includes('/media/'),
  )
  if (!manifestPath) {
    throw createError({
      statusCode: 422,
      statusMessage: "Archive sans manifest.json : ce n'est pas une sauvegarde du site",
    })
  }
  const root = manifestPath.slice(0, manifestPath.length - 'manifest.json'.length)

  /** A section absent from an older archive is empty, not fatal. */
  const read = <T>(path: string, fallback: T): T => {
    const file = files[`${root}${path}`]
    if (!file) return fallback
    try {
      return JSON.parse(strFromU8(file)) as T
    } catch {
      throw createError({
        statusCode: 422,
        statusMessage: `Fichier illisible dans l'archive : ${path}`,
      })
    }
  }

  const links = read<{ tags?: unknown[]; social?: unknown[] }>('data/links.json', {})

  return {
    manifest: read('manifest.json', { version: 0, exportedAt: '', counts: {} }),
    articles: read<unknown[]>('data/articles.json', []),
    tags: read<unknown[]>('data/tags.json', []),
    tagLinks: links.tags ?? [],
    media: read<unknown[]>('media/manifest.json', []),
    socialAccounts: read<unknown[]>('data/social_accounts.json', []),
    socialPosts: read<unknown[]>('data/social_posts.json', []),
    socialLinks: links.social ?? [],
    settings: read<unknown[]>('data/settings.json', []),
    users: read<unknown[]>('data/users.json', []),
    views: read<unknown[]>('data/views.json', []),
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
/**
 * What a restore can be asked to bring back, one chunk per meaning.
 *
 * Grouped by what they ARE and not by table: whoever ticks « Articles »
 * means the articles WITH their subjects, not a list of rows whose links
 * would be missing.
 */
export const IMPORT_PARTS = [
  'articles',
  'media',
  'publications',
  'settings',
  'users',
  'views',
] as const

export type ImportPart = (typeof IMPORT_PARTS)[number]

export async function applyImport(
  archive: Archive,
  options: { wipe: boolean; parts?: readonly ImportPart[] },
): Promise<Record<string, number>> {
  const db = useDatabase()
  const asked = new Set<ImportPart>(options.parts ?? IMPORT_PARTS)

  /**
   * An article points at its cover, which lives in `media`.
   *
   * Restoring the articles without the media would break on the foreign
   * key — and only once the insert ran, halfway through the restore. The
   * dependency is resolved here rather than left to whoever ticks the
   * boxes.
   */
  const wants = (part: ImportPart): boolean =>
    asked.has(part) || (part === 'media' && asked.has('articles'))

  if (archive.manifest?.version !== SCHEMA_VERSION) {
    throw createError({
      statusCode: 422,
      statusMessage: `Archive de version ${archive.manifest?.version}, attendue ${SCHEMA_VERSION}`,
    })
  }

  if (options.wipe) {
    // `secret` is ABSENT from this list, on purpose: an import must not be
    // able to erase the access tokens of third-party accounts.
    //
    // Only what is about to be rewritten is emptied: wiping the articles to
    // restore the settings alone would destroy content the archive is not
    // going to put back.
    const tables: string[] = []
    if (wants('articles')) tables.push('article_tag', 'article')
    if (wants('publications')) tables.push('article_social_post', 'social_post', 'social_account')
    if (wants('views')) tables.push('article_view')
    if (wants('articles')) tables.push('tag')
    if (wants('media')) tables.push('media')
    if (wants('settings')) tables.push('setting')
    if (wants('users')) tables.push('app_user')

    if (tables.length) {
      await db.execute(
        sql`truncate table ${sql.join(
          [...new Set(tables)].map((t) => sql.identifier(t)),
          sql`, `,
        )} restart identity cascade`,
      )
    }
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

  /** Skipped means absent from the report, not « zero written ». */
  const maybe = async <T>(
    part: ImportPart,
    name: string,
    table: never,
    lines: T[],
  ): Promise<void> => {
    if (wants(part)) await insert(name, table, lines)
  }

  // The order follows the dependencies: whatever is referenced comes first.
  await maybe('users', 'users', appUser as never, archive.users as never[])
  await maybe('media', 'media', media as never, archive.media as never[])
  await maybe('articles', 'tags', tag as never, archive.tags as never[])
  await maybe('articles', 'articles', article as never, archive.articles as never[])
  // Accounts BEFORE posts: the latter reference the former.
  await maybe(
    'publications',
    'socialAccounts',
    socialAccount as never,
    archive.socialAccounts as never[],
  )
  await maybe('publications', 'socialPosts', socialPost as never, archive.socialPosts as never[])
  await maybe('articles', 'tagLinks', articleTag as never, archive.tagLinks as never[])
  // A link needs BOTH ends: restoring it without one would point nowhere.
  if (wants('articles') && wants('publications'))
    await insert('socialLinks', articleSocialPost as never, archive.socialLinks as never[])
  await maybe('settings', 'settings', setting as never, archive.settings as never[])
  await maybe('views', 'views', articleView as never, archive.views as never[])

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
