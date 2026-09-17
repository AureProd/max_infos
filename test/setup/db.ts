import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'

/**
 * A real, ephemeral PostgreSQL database, provided by the `db-test` service
 * of the development compose (in memory, no durability).
 *
 * Every test runs inside a transaction rolled back at the end: perfect
 * isolation, no cleanup, no leakage from one test to the next. The pattern
 * holds ONLY for tests using the connection provided here — a Nitro handler
 * opens its own connections and would see nothing the transaction wrote.
 */

// Falls back to the db-test database of the development compose:
// ephemeral, in memory, bound to 127.0.0.1.
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test'

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>

/** Replays every migration, in journal order. */
export async function migrate(sql: postgres.Sql): Promise<void> {
  const folder = join(process.cwd(), 'drizzle')
  const files = readdirSync(folder)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  await sql.unsafe('drop schema if exists public cascade; create schema public;')
  for (const file of files) {
    const content = readFileSync(join(folder, file), 'utf8')
    // drizzle-kit separates statements with this marker.
    for (const statement of content.split('--> statement-breakpoint')) {
      const cleaned = statement.trim()
      if (cleaned) await sql.unsafe(cleaned)
    }
  }
}

export function connection(): postgres.Sql {
  return postgres(TEST_URL, { max: 1, onnotice: () => {} })
}

export function database(sql: postgres.Sql): TestDatabase {
  return drizzle(sql, { schema, casing: 'snake_case' })
}

/**
 * Checks that a write is refused BY THE EXPECTED CONSTRAINT.
 *
 * Drizzle wraps the PostgreSQL error: its message only holds the query, and
 * the constraint name lives in `cause`. Settling for « it failed » would
 * let a failure for an entirely different reason through — a typo in the
 * test, for instance.
 */
export async function rejectedByConstraint(
  action: () => Promise<unknown>,
  constraint: string,
): Promise<void> {
  try {
    await action()
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error
    const name = (cause as { constraint_name?: string }).constraint_name
    const message = (cause as { message?: string }).message ?? String(cause)
    if (name !== constraint && !message.includes(constraint)) {
      throw new Error(`Refus attendu par « ${constraint} », obtenu « ${name ?? message} »`)
    }
    return
  }
  throw new Error(`L'écriture aurait dû être refusée par « ${constraint} »`)
}

/**
 * Remplit la database de test avec un jeu minimal et lisible.
 *
 * Deliberately distinct from the real content: a test depending on the real
 * articles breaks as soon as Max publishes one.
 */
export async function seedTestData(db: TestDatabase): Promise<void> {
  const s = await import('../../server/database/schema')

  const [tagGeo] = await db.insert(s.tag).values({ slug: 'geo', label: 'Géographie' }).returning()
  const [tagMem] = await db.insert(s.tag).values({ slug: 'mem', label: 'Alpha' }).returning()

  const [img] = await db
    .insert(s.media)
    .values({ url: 'https://exemple.test/cover.png', mime: 'image/png', alt: 'Couverture' })
    .returning()

  const [published] = await db
    .insert(s.article)
    .values({
      slug: 'article-publie',
      title: 'Un article publié',
      dek: 'Son chapô',
      bodyHtml: '<p>Le corps contient le mot rarissime zzyzx.</p>',
      // La recherche porte sur le TEXTE, pas sur le balisage : l'insertion
      // directe doit donc le poser, là où un enregistrement passé par
      // `derivedFields` l'aurait dérivé.
      bodyText: 'Le corps contient le mot rarissime zzyzx.',
      status: 'published',
      publishedAt: new Date('2026-09-10T12:00:00Z'),
      coverMediaId: img?.id ?? null,
      readingMinutes: 4,
      charCount: 1234,
    })
    .returning()

  const [older] = await db
    .insert(s.article)
    .values({
      slug: 'article-ancien',
      title: 'Un article plus ancien',
      status: 'published',
      publishedAt: new Date('2026-01-01T12:00:00Z'),
      readingMinutes: 2,
      charCount: 500,
    })
    .returning()

  await db.insert(s.article).values({
    slug: 'article-brouillon',
    title: 'Un brouillon',
    status: 'draft',
  })

  if (published && tagGeo)
    await db.insert(s.articleTag).values({ articleId: published.id, tagId: tagGeo.id })
  if (older && tagMem)
    await db.insert(s.articleTag).values({ articleId: older.id, tagId: tagMem.id })

  // Two Instagram accounts: one shown, one hidden. That is the minimum for
  // « one section per account » to be checkable, and for a leak test to
  // have something it must NOT let through.
  const [account] = await db
    .insert(s.socialAccount)
    .values({
      network: 'instagram',
      externalId: 'IG-1',
      username: 'maxinfo',
      displayName: 'Un Max d’info',
      biography: 'La bio venue d’Instagram',
      avatarUrl: 'https://exemple.test/avatar.png',
      followers: 120,
      mediaCount: 7,
      visible: true,
      position: 0,
      // Deliberately 1: the truncation must show.
      postsOnHome: 1,
    })
    .returning()

  const [hiddenAccount] = await db
    .insert(s.socialAccount)
    .values({
      network: 'instagram',
      externalId: 'IG-2',
      username: 'archives',
      visible: false,
      position: 1,
    })
    .returning()

  const [post] = await db
    .insert(s.socialPost)
    .values({
      network: 'instagram',
      accountId: account?.id ?? null,
      externalId: 'ABC123',
      shortcode: 'ABC123',
      mediaType: 'reel',
      caption: 'Une légende',
      postedAt: new Date('2026-09-10T12:00:00Z'),
      source: 'api',
      // Used to check that Meta's payload NEVER leaves through an API
      // response. Dummy value.
      raw: { secret_meta: 'ne doit jamais sortir' },
    })
    .returning()

  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: account?.id ?? null,
    externalId: 'CACHE1',
    shortcode: 'CACHE1',
    source: 'api',
    hidden: true,
  })

  // Older than ABC123: this is the one truncating to a single post must
  // leave out.
  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: account?.id ?? null,
    externalId: 'DEF456',
    shortcode: 'DEF456',
    source: 'api',
    postedAt: new Date('2026-01-01T12:00:00Z'),
  })

  // Visible in itself, but attached to the HIDDEN account: it must not
  // appear on the home page.
  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: hiddenAccount?.id ?? null,
    externalId: 'MASQ1',
    shortcode: 'MASQ1',
    source: 'api',
    postedAt: new Date('2025-06-01T12:00:00Z'),
  })

  // Added by hand from the Publications screen: no account, and therefore
  // no section on the home page to live in. Production shipped three of
  // these on 15/09/2026, and none of them was ever displayed.
  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: null,
    externalId: null,
    shortcode: 'MAIN1',
    source: 'manual',
    // A caption, so a rendering test can look for it: the card shows the
    // caption, never the shortcode.
    caption: 'Publication ajoutée à la main',
    permalink: 'https://www.instagram.com/p/MAIN1/',
    postedAt: new Date('2026-09-14T12:00:00Z'),
  })

  if (published && post)
    await db.insert(s.articleSocialPost).values({ articleId: published.id, socialPostId: post.id })

  await db.insert(s.setting).values([
    {
      key: 'identity',
      value: {
        name: 'Site de test',
        author: 'Autrice de test',

        tagline: '',
        pitch: '',
      },
      scope: 'public',
    },
    // A TECHNICAL setting: used to check it never leaves through /api/site.
    { key: 'instagram', value: { accountId: 'compte-prive-123' }, scope: 'tech' },
  ])
}
