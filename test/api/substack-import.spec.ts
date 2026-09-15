import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * Repatriating a Substack publication.
 *
 * Two families of post: those the site already carries — which only gain
 * their original link and cover — and those it does not, which become
 * DRAFTS. Nothing is ever published: the conversion is good enough to read,
 * not good enough to trust.
 *
 * No network here either: the feed arrives as text, as the route hands it
 * over once fetched.
 */

let sqlClient: postgres.Sql
let db: TestDatabase

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { importSubstack } = await import('../../server/utils/substack-import')
const { article, media } = await import('../../server/database/schema')

const feed = (items: string): string =>
  `<?xml version="1.0"?><rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>${items}</channel></rss>`

const item = (o: {
  title: string
  slug: string
  body?: string
  cover?: string
  date?: string
}): string =>
  `<item>
     <title><![CDATA[${o.title}]]></title>
     <link>https://unmaxdinfo.substack.com/p/${o.slug}</link>
     <pubDate>${o.date ?? 'Tue, 04 Mar 2026 08:00:00 GMT'}</pubDate>
     <description><![CDATA[Le chapô.]]></description>
     ${o.cover ? `<enclosure url="${o.cover}" type="image/jpeg"/>` : ''}
     <content:encoded><![CDATA[${o.body ?? '<p><span>Le corps.</span></p>'}]]></content:encoded>
   </item>`

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe('truncate table article_tag, article, tag, media restart identity cascade')
})

describe('a post the site does not have', () => {
  it('becomes a DRAFT, never a publication', async () => {
    // The conversion is reviewed by a human. Publishing straight away would
    // put markup nobody read in front of readers.
    const report = await importSubstack(feed(item({ title: 'Ben Mhidi', slug: 'ben-mhidi' })), {
      dryRun: false,
    })

    expect(report.created).toHaveLength(1)
    const [row] = await db.select().from(article)
    expect(row?.status).toBe('draft')
    expect(row?.title).toBe('Ben Mhidi')
    expect(row?.substackUrl).toBe('https://unmaxdinfo.substack.com/p/ben-mhidi')
  })

  it('arrives with its body in Markdown, and its counts computed', async () => {
    const body = '<p><span>Un </span><em><span>mot</span></em><span> juste.</span></p>'
    await importSubstack(feed(item({ title: 'Titre', slug: 't', body })), { dryRun: false })

    const [row] = await db.select().from(article)
    expect(row?.bodyMd).toBe('Un _mot_ juste.')
    // Rendered and counted by the same functions as a hand-written article:
    // an imported draft is an article like any other.
    expect(row?.bodyHtml).toContain('<em>mot</em>')
    expect(row?.charCount).toBeGreaterThan(0)
    expect(row?.readingMinutes).toBeGreaterThanOrEqual(1)
  })

  it('keeps the original date, so the order survives publication', async () => {
    await importSubstack(feed(item({ title: 'Titre', slug: 't' })), { dryRun: false })
    const [row] = await db.select().from(article)
    expect(row?.publishedAt?.toISOString()).toBe('2026-03-04T08:00:00.000Z')
  })

  it('takes a free slug rather than colliding', async () => {
    // The post matches nothing — neither by link slug nor by title — but the
    // slug its title would take is already held.
    await db.insert(article).values({ slug: 'ben-mhidi', title: 'Un autre' })
    await importSubstack(feed(item({ title: 'Ben Mhidi', slug: 'autre-chose' })), {
      dryRun: false,
    })

    const slugs = (await db.select().from(article)).map((a) => a.slug).sort()
    expect(slugs).toEqual(['ben-mhidi', 'ben-mhidi-2'])
  })

  it('attaches the cover without re-uploading it', async () => {
    // The media row carries the Substack CDN address and r2Key stays null:
    // that is why the column is nullable.
    const cover = 'https://substackcdn.com/image/fetch/cover.jpg'
    await importSubstack(feed(item({ title: 'Titre', slug: 't', cover })), { dryRun: false })

    const [m] = await db.select().from(media)
    expect(m?.url).toBe(cover)
    expect(m?.r2Key).toBeNull()
    const [row] = await db.select().from(article)
    expect(row?.coverMediaId).toBe(m?.id)
  })
})

describe('a post the site already has', () => {
  it('gains its link and its cover, and nothing else', async () => {
    const cover = 'https://substackcdn.com/image/fetch/cover.jpg'
    await db.insert(article).values({
      slug: 'ben-mhidi',
      title: 'Ben Mhidi',
      bodyMd: 'Le texte écrit à la main.',
      status: 'published',
      // The `article_published_coherent` constraint refuses a published
      // article without a date — and it is right to.
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    })

    const report = await importSubstack(
      feed(item({ title: 'Ben Mhidi', slug: 'ben-mhidi', cover })),
      { dryRun: false },
    )

    expect(report.created).toHaveLength(0)
    expect(report.linked).toBe(1)
    expect(report.covers).toBe(1)

    const [row] = await db.select().from(article)
    // The hand-written text is NOT overwritten: that is the whole point.
    expect(row?.bodyMd).toBe('Le texte écrit à la main.')
    expect(row?.status).toBe('published')
    expect(row?.substackUrl).toContain('/p/ben-mhidi')
  })

  it('is recognised by its title even when the slug differs', async () => {
    await db.insert(article).values({ slug: 'autre-slug', title: 'Ben Mhidi' })
    const report = await importSubstack(feed(item({ title: 'Ben Mhidi', slug: 'ben-mhidi' })), {
      dryRun: false,
    })
    expect(report.created).toHaveLength(0)
    expect(report.linked).toBe(1)
  })

  it('runs twice without changing anything the second time', async () => {
    const xml = feed(item({ title: 'Ben Mhidi', slug: 'ben-mhidi' }))
    await importSubstack(xml, { dryRun: false })
    const second = await importSubstack(xml, { dryRun: false })

    expect(second.created).toHaveLength(0)
    expect(second.linked).toBe(0)
    expect(await db.select().from(article)).toHaveLength(1)
  })
})

describe('the dry run', () => {
  it('says what it would do and writes nothing', async () => {
    // Importing is not something you run twice out of curiosity.
    const report = await importSubstack(feed(item({ title: 'Ben Mhidi', slug: 'ben-mhidi' })), {
      dryRun: true,
    })

    expect(report.dryRun).toBe(true)
    expect(report.created).toHaveLength(1)
    expect(await db.select().from(article)).toHaveLength(0)
    expect(await db.select().from(media)).toHaveLength(0)
  })
})

describe('a feed that does not say what it should', () => {
  it('ignores an entry without a title or a link', async () => {
    const xml = feed('<item><title>Sans lien</title></item>')
    const report = await importSubstack(xml, { dryRun: false })
    expect(report.created).toHaveLength(0)
  })

  it('refuses something that is not a feed, rather than importing nothing', async () => {
    // Silence would look like « the publication is empty », and Max would
    // hunt for the wrong problem.
    await expect(
      importSubstack('<html><body>Oups</body></html>', { dryRun: true }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})
