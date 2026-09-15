/**
 * Initial migration from Substack: covers and original links.
 *
 *   pnpm substack https://unmaxdinfo.substack.com/feed
 *   pnpm substack <url> --dry     writes nothing, shows what would be done
 *
 * What this script does, and NOTHING else: attach every article already in
 * the database to its Substack post (`substack_url`) and give it its
 * original cover when it lacks one. It does not import bodies — the feed
 * gives them as HTML, the site's articles are Markdown, and an automatic
 * conversion would produce markup Max would have to review article by
 * article. Posts without a match are therefore REPORTED, not created: the
 * decision stays with a human.
 *
 * The image is not copied into R2: the `media` row carries the Substack CDN
 * URL and `r2_key` stays null, which is why that column is nullable. An
 * accepted trade-off worth knowing: should Max close his Substack one day,
 * these covers disappear — they will simply have to be re-uploaded from the
 * editing screen.
 *
 * Idempotent: run again, it only rewrites what is still missing.
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import { parseSubstackFeed } from '../server/utils/substack'
import { slugify } from '../shared/utils/slug'

const feedUrl = process.argv[2]
const dryRun = process.argv.includes('--dry')

if (!feedUrl?.startsWith('http')) {
  console.error(
    'Usage : pnpm substack <url du flux> [--dry]\nExemple : pnpm substack https://unmaxdinfo.substack.com/feed',
  )
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('/!\\ DATABASE_URL manquante')
  process.exit(1)
}

const sqlClient = postgres(databaseUrl, { max: 1, onnotice: () => {} })
const db = drizzle(sqlClient, { schema, casing: 'snake_case' })

/** The slug Substack gives the post: the last segment of the URL. */
function substackSlug(link: string): string {
  return (
    link
      .replace(/[?#].*$/, '')
      .replace(/\/$/, '')
      .split('/')
      .pop() ?? ''
  )
}

async function main(): Promise<void> {
  const response = await fetch(feedUrl as string, { headers: { accept: 'application/rss+xml' } })
  if (!response.ok) throw new Error(`Le flux a répondu ${response.status}`)

  const posts = parseSubstackFeed(await response.text())
  console.log(`${posts.length} billet(s) dans le flux.\n`)

  const articles = await db
    .select({
      id: schema.article.id,
      slug: schema.article.slug,
      title: schema.article.title,
      substackUrl: schema.article.substackUrl,
      coverMediaId: schema.article.coverMediaId,
    })
    .from(schema.article)

  let linked = 0
  let covers = 0
  const orphans: string[] = []

  for (const b of posts) {
    // Three matching keys, from the safest to the loosest: the link
    // already recorded, the Substack slug, then the slugified title.
    const target =
      articles.find((a) => a.substackUrl === b.link) ??
      articles.find((a) => a.slug === substackSlug(b.link)) ??
      articles.find((a) => slugify(a.title) === slugify(b.title))

    if (!target) {
      orphans.push(`${b.title} — ${b.link}`)
      continue
    }

    if (!target.substackUrl) {
      console.log(`  lien    ${target.slug} → ${b.link}`)
      if (!dryRun) {
        await db
          .update(schema.article)
          .set({ substackUrl: b.link })
          .where(eq(schema.article.id, target.id))
      }
      linked++
    }

    if (!target.coverMediaId && b.cover) {
      console.log(`  couv.   ${target.slug} → ${b.cover.slice(0, 70)}…`)
      if (!dryRun) {
        // A lookup before the insert, and not `onConflictDoUpdate`: `url`
        // does NOT carry a unique index (only `r2_key` does), and targeting
        // a column without a constraint only fails the query at runtime.
        // Running the script again must not create a second medium for the
        // same image.
        const [existing] = await db
          .select({ id: schema.media.id })
          .from(schema.media)
          .where(eq(schema.media.url, b.cover))
          .limit(1)

        const m =
          existing ??
          (
            await db
              .insert(schema.media)
              .values({
                r2Key: null,
                url: b.cover,
                mime: 'image/jpeg',
                bytes: 0,
                kind: 'image',
                alt: `Couverture de « ${b.title} »`,
              })
              .returning({ id: schema.media.id })
          )[0]

        if (m) {
          await db
            .update(schema.article)
            .set({ coverMediaId: m.id })
            .where(eq(schema.article.id, target.id))
        }
      }
      covers++
    }
  }

  // The sequences do not move here (no explicit identifier is inserted),
  // but we check: a desynchronised sequence breaks the next upload, and the
  // error would say nothing about this script.
  if (!dryRun) {
    await db.execute(
      sql`select setval(pg_get_serial_sequence('media', 'id'), coalesce((select max(id) from media), 1))`,
    )
  }

  console.log(`\n${linked} lien(s), ${covers} cover(s)${dryRun ? ' (essai à blanc)' : ''}.`)
  if (orphans.length) {
    console.log(`\n${orphans.length} billet(s) sans article correspondant, à créer à la main :`)
    for (const o of orphans) console.log(`  - ${o}`)
  }
}

main()
  .catch((e) => {
    console.error(`/!\\ ${(e as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
