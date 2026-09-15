import { eq } from 'drizzle-orm'
import { slugify } from '#shared/utils/slug'
import { useDatabase } from '~~/server/database/client'
import { article, media } from '~~/server/database/schema'
import { derivedFields, freeSlug } from './articles'
import { parseSubstackFeed } from './substack'
import { htmlToMarkdown } from './substack-markdown'

/**
 * Repatriating a Substack publication.
 *
 * Two families of post. Those the site ALREADY carries only gain their
 * original link and cover — the hand-written text is never overwritten,
 * which is the whole reason this is not a blind copy. Those it does not
 * carry become DRAFTS: the conversion is good enough to read, not good
 * enough to put in front of readers unreviewed.
 *
 * The images are not copied into R2. The `media` row carries the Substack
 * CDN address and `r2_key` stays null — that is why the column is nullable.
 * An accepted trade-off worth knowing: should the Substack close one day,
 * these covers vanish and will have to be re-uploaded from the editing
 * screen.
 *
 * Idempotent: run again, it only writes what is still missing.
 */

export interface ImportReport {
  dryRun: boolean
  /** Existing articles that gained their Substack link. */
  linked: number
  /** Existing articles that gained their original cover. */
  covers: number
  /** Posts the site did not have, created as drafts. */
  created: { slug: string; title: string }[]
  /** Posts matched to an article that already had everything. */
  untouched: number
}

/**
 * The only addresses the server agrees to go and fetch.
 *
 * SSRF: the address comes from a human, and it is the SERVER that follows
 * it. Without this, an editor turns the site into a probe for the VPS's own
 * network — the database on localhost, the host's metadata service, anything
 * listening inside.
 *
 * `hostname` is compared, never the whole string: `substack.com.evil.test`
 * contains « substack.com » and is not Substack. https only, so that no
 * redirect can downgrade the trip.
 *
 * 409 on an empty address and 422 on a refused one, and the difference
 * matters: the first says « nothing configured yet », the second « I will
 * not fetch that ».
 */
export function checkedFeedUrl(raw: string): string {
  const value = (raw ?? '').trim()
  if (!value) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Aucun flux Substack enregistré : renseigne son adresse.',
    })
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw createError({ statusCode: 422, statusMessage: "Cette adresse n'est pas une URL" })
  }

  const isSubstack = url.hostname === 'substack.com' || url.hostname.endsWith('.substack.com')
  if (url.protocol !== 'https:' || !isSubstack) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Seule une adresse https d’un domaine substack.com est acceptée',
    })
  }

  return url.href
}

/** The slug Substack gives a post: the last segment of its address. */
function substackSlug(link: string): string {
  return (
    link
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '')
      .split('/')
      .pop() ?? ''
  )
}

/** A medium for a cover, reused if the address is already known. */
async function coverFor(url: string, title: string): Promise<number | null> {
  const db = useDatabase()

  // A lookup before the insert, and not `onConflictDoUpdate`: `url` carries
  // NO unique index — only `r2_key` does — and aiming a conflict clause at a
  // column without a constraint fails at runtime only. Running the import
  // again must not create a second medium for the same image.
  const [known] = await db.select({ id: media.id }).from(media).where(eq(media.url, url)).limit(1)
  if (known) return known.id

  const [created] = await db
    .insert(media)
    .values({
      r2Key: null,
      url,
      mime: 'image/jpeg',
      bytes: 0,
      kind: 'image',
      alt: `Couverture de « ${title} »`,
    })
    .returning({ id: media.id })

  return created?.id ?? null
}

export async function importSubstack(
  xml: string,
  options: { dryRun: boolean },
): Promise<ImportReport> {
  // Silence would read as « the publication is empty », and the wrong
  // problem would be hunted for. An HTML error page is the usual shape of a
  // wrong address.
  if (!/<rss[\s>]|<channel[\s>]/i.test(xml)) {
    throw createError({
      statusCode: 422,
      statusMessage: "Ce n'est pas un flux RSS Substack",
    })
  }

  const db = useDatabase()
  const posts = parseSubstackFeed(xml)

  const existing = await db
    .select({
      id: article.id,
      slug: article.slug,
      title: article.title,
      substackUrl: article.substackUrl,
      coverMediaId: article.coverMediaId,
    })
    .from(article)

  const report: ImportReport = {
    dryRun: options.dryRun,
    linked: 0,
    covers: 0,
    created: [],
    untouched: 0,
  }

  for (const post of posts) {
    // Three matching keys, from the safest to the loosest: the link already
    // recorded, the Substack slug, then the slugified title.
    //
    // The last one ignores an article ALREADY tied to another post: two
    // distinct posts can share a title, and merging them would lose one of
    // the two without a word. The looser the key, the more it has to earn.
    const target =
      existing.find((a) => a.substackUrl === post.link) ??
      existing.find((a) => a.slug === substackSlug(post.link)) ??
      existing.find((a) => !a.substackUrl && slugify(a.title) === slugify(post.title))

    if (target) {
      let touched = false

      if (!target.substackUrl) {
        report.linked++
        touched = true
        if (!options.dryRun) {
          await db.update(article).set({ substackUrl: post.link }).where(eq(article.id, target.id))
          target.substackUrl = post.link
        }
      }

      if (!target.coverMediaId && post.cover) {
        report.covers++
        touched = true
        if (!options.dryRun) {
          const id = await coverFor(post.cover, post.title)
          if (id) {
            await db.update(article).set({ coverMediaId: id }).where(eq(article.id, target.id))
            target.coverMediaId = id
          }
        }
      }

      if (!touched) report.untouched++
      continue
    }

    const slug = await freeSlug(post.title)
    report.created.push({ slug, title: post.title })
    if (options.dryRun) continue

    const bodyMd = htmlToMarkdown(post.bodyHtml)
    const coverMediaId = post.cover ? await coverFor(post.cover, post.title) : null

    const [created] = await db
      .insert(article)
      .values({
        slug,
        title: post.title,
        dek: post.dek || null,
        bodyMd,
        // Rendered and counted by the same functions as a hand-written
        // article: an imported draft is an article like any other.
        ...derivedFields(bodyMd),
        // `draft`, always. The date is kept all the same, so that the order
        // survives the day Max publishes it here.
        status: 'draft',
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
        substackUrl: post.link,
        coverMediaId,
      })
      .returning({ id: article.id, slug: article.slug, title: article.title })

    // Kept in the working set: a second post of the same title must not be
    // matched to the one just created, nor take its slug.
    if (created) {
      existing.push({
        ...created,
        substackUrl: post.link,
        coverMediaId,
      })
    }
  }

  return report
}
