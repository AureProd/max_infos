/**
 * One-off: repair the deks imported before decode() handled numeric entities.
 *
 *   pnpm fix-deks --dry     shows what would change, writes nothing
 *   pnpm fix-deks
 *   pnpm fix-deks <feed url> [--dry]
 *
 * Measured in production on 16/09/2026: the two articles migrated from
 * Substack carried « identit&#233; » and « op&#233;rations » in `dek`, and the
 * site showed the entity itself — Vue escapes the ampersand on the way out.
 * Titles and bodies were NOT affected: they travel inside CDATA.
 *
 * Re-importing does not fix them, and that is deliberate: the import never
 * overwrites the dek of an article that already exists, because Max may have
 * rewritten it. Hence this script.
 *
 * WHY IT RE-READS THE FEED rather than decoding what is in the database.
 * The obvious version — run decode() over the stored dek — is DESTRUCTIVE on
 * a second run, and a dry run proved it before this ever touched production.
 * Once repaired, a dek can legitimately contain the text « &#233; », which is
 * indistinguishable from an entity awaiting decoding: the second pass turns
 * the documentation of an entity into « é ». There is no way to tell them
 * apart from the stored value alone.
 *
 * So the feed is the source of truth. The dek is re-derived from it, through
 * the now-correct decode(), and writing the same value twice changes nothing.
 * Run it as often as you like.
 *
 * Only articles tied to a Substack post are considered, and only those whose
 * dek actually differs are written: an article whose dek Max has since
 * rewritten by hand is left alone unless the feed disagrees — which is the
 * same rule the import itself follows.
 */
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import { parseSubstackFeed } from '../server/utils/substack'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry')
const feedFromArgs = args.find((a) => a.startsWith('http'))

const databaseUrl = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('/!\\ DATABASE_URL manquante')
  process.exit(1)
}

const sqlClient = postgres(databaseUrl, { max: 1, onnotice: () => {} })
const db = drizzle(sqlClient, { schema, casing: 'snake_case' })

/** The feed address, from the command line or from the `substack` setting. */
async function feedUrl(): Promise<string> {
  if (feedFromArgs) return feedFromArgs
  const [row] = await db
    .select({ value: schema.setting.value })
    .from(schema.setting)
    .where(eq(schema.setting.key, 'substack'))
    .limit(1)
  const url = (row?.value as { feedUrl?: string } | undefined)?.feedUrl
  if (!url)
    throw new Error(
      "Aucune adresse de flux : la passer en argument, ou la régler dans l'écran Articles",
    )
  return url
}

async function main(): Promise<void> {
  const url = await feedUrl()
  const response = await fetch(url, { headers: { accept: 'application/rss+xml' } })
  if (!response.ok) throw new Error(`Le flux a répondu ${response.status}`)

  const posts = parseSubstackFeed(await response.text())
  console.log(`${posts.length} billet(s) dans le flux.\n`)

  const articles = await db
    .select({
      id: schema.article.id,
      slug: schema.article.slug,
      dek: schema.article.dek,
      substackUrl: schema.article.substackUrl,
    })
    .from(schema.article)

  let fixed = 0

  for (const post of posts) {
    const target = articles.find((a) => a.substackUrl === post.link)
    if (!target) continue

    const wanted = post.dek || null
    if (wanted === null || wanted === target.dek) continue

    console.log(`  ${target.slug}`)
    console.log(`    avant : ${target.dek}`)
    console.log(`    après : ${wanted}`)

    if (!dryRun) {
      await db.update(schema.article).set({ dek: wanted }).where(eq(schema.article.id, target.id))
    }
    fixed++
  }

  console.log(
    fixed === 0
      ? '\nAucun chapô à réparer.'
      : `\n${fixed} chapô(s) réparé(s)${dryRun ? ' — essai à blanc, rien écrit' : ''}.`,
  )
}

main()
  .catch((e) => {
    console.error(`/!\\ ${(e as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
