/**
 * One-off: repair the deks imported before decode() handled numeric entities.
 *
 *   pnpm fix-deks --dry     shows what would change, writes nothing
 *   pnpm fix-deks
 *
 * Measured in production on 16/09/2026: the two articles migrated from
 * Substack carried « identit&#233; » and « op&#233;rations » in `dek`, and the
 * site showed the entity itself — Vue escapes the ampersand on the way out.
 * Titles and bodies were NOT affected: they travel inside CDATA.
 *
 * Re-importing does not fix them, and that is deliberate: the import never
 * overwrites the dek of an article that already exists, because Max may have
 * rewritten it. Hence this script rather than a second run of `pnpm substack`.
 *
 * Only rows that still hold an entity are touched, so running it twice is
 * harmless. Known and accepted limit: a dek deliberately WRITING about an
 * entity — the literal text « &#233; » — would be converted too. Across two
 * articles about Franco-Algerian memory, that is not a risk worth code.
 */

import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import { decode } from '../server/utils/substack'

const dryRun = process.argv.includes('--dry')

const databaseUrl = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  console.error('/!\\ DATABASE_URL manquante')
  process.exit(1)
}

/** Decimal, hexadecimal, or named: anything still awaiting decoding. */
const HAS_ENTITY = /&#\d+;|&#x[0-9a-fA-F]+;|&[A-Za-z]+;/

const sqlClient = postgres(databaseUrl, { max: 1, onnotice: () => {} })
const db = drizzle(sqlClient, { schema, casing: 'snake_case' })

async function main(): Promise<void> {
  const articles = await db
    .select({ id: schema.article.id, slug: schema.article.slug, dek: schema.article.dek })
    .from(schema.article)

  let fixed = 0

  for (const a of articles) {
    if (!a.dek || !HAS_ENTITY.test(a.dek)) continue

    const repaired = decode(a.dek)
    if (repaired === a.dek) continue

    console.log(`  ${a.slug}`)
    console.log(`    avant : ${a.dek}`)
    console.log(`    après : ${repaired}`)

    if (!dryRun) {
      await db.update(schema.article).set({ dek: repaired }).where(eq(schema.article.id, a.id))
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
