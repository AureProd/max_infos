import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * Export and import, against a REAL database.
 *
 * Two things a fake could never prove: that `secret` survives an import
 * which erases everything else, and that the sequences are moved past the
 * highest restored identifier — a failure that would otherwise surface on
 * the first article written LONG after the import was believed to have
 * succeeded.
 */

let sqlClient: postgres.Sql
let db: TestDatabase

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { buildExport, applyImport, SCHEMA_VERSION } = await import('../../server/utils/export')
const { article, secret, tag } = await import('../../server/database/schema')

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe(`truncate table
    article_view, article_social_post, article_tag, social_post,
    article, tag, media, setting, secret, app_user, social_account
    restart identity cascade`)
})

const emptyArchive = () => ({
  manifest: { version: SCHEMA_VERSION, exportedAt: '2026-09-15T00:00:00.000Z', counts: {} },
  articles: [],
  tags: [],
  tagLinks: [],
  media: [],
  socialAccounts: [],
  socialPosts: [],
  socialLinks: [],
  settings: [],
  users: [],
  views: [],
})

describe('buildExport', () => {
  it('stamps the schema version, so an import can refuse what it cannot read', async () => {
    expect((await buildExport()).manifest.version).toBe(SCHEMA_VERSION)
  })

  it('counts what it actually carries', async () => {
    await seedTestData(db)
    const archive = await buildExport()
    expect(archive.manifest.counts.articles).toBe(archive.articles.length)
    expect(archive.manifest.counts.socialPosts).toBe(archive.socialPosts.length)
    expect(archive.articles).toHaveLength(3)
  })

  it('never carries a single token, whatever the shape of the archive', async () => {
    // This is a border not to cross: the archive is downloaded, and holding
    // third-party credentials would take them out of the system.
    await seedTestData(db)
    await db.insert(secret).values({ key: 'instagram:1', ciphertext: 'JETON-TRES-SECRET' })

    const archive = await buildExport()
    expect(Object.keys(archive)).not.toContain('secrets')
    expect(JSON.stringify(archive)).not.toContain('JETON-TRES-SECRET')
  })

  it('exports an account without any way to sign in as it', async () => {
    await seedTestData(db)
    await sqlClient.unsafe(
      `insert into app_user (email, name, role) values ('max@exemple.test', 'Max', 'editor')`,
    )
    const [user] = (await buildExport()).users as Record<string, unknown>[]
    expect(Object.keys(user ?? {}).sort()).toEqual(['active', 'email', 'name', 'role'])
  })
})

describe('applyImport', () => {
  it('refuses an archive it cannot read, naming both versions', async () => {
    const archive = { ...emptyArchive(), manifest: { version: 1 } } as never
    await expect(applyImport(archive, { wipe: false })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('refuses an archive without a manifest rather than writing nonsense', async () => {
    await expect(applyImport({} as never, { wipe: false })).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('spares the secrets when it erases everything else', async () => {
    // The `secret` table is absent from the truncate, on purpose.
    await seedTestData(db)
    await db.insert(secret).values({ key: 'instagram:1', ciphertext: 'JETON' })

    await applyImport(emptyArchive() as never, { wipe: true })

    expect(await db.select().from(article)).toHaveLength(0)
    expect(await db.select().from(secret)).toHaveLength(1)
  })

  it('destroys nothing without wipe', async () => {
    await seedTestData(db)
    await applyImport(emptyArchive() as never, { wipe: false })
    expect(await db.select().from(article)).toHaveLength(3)
  })

  it('makes the round trip, content unchanged', async () => {
    await seedTestData(db)
    const archive = await buildExport()

    const written = await applyImport(archive as never, { wipe: true })

    expect(written.articles).toBe(3)
    expect((await db.select().from(article)).map((a) => a.slug).sort()).toEqual([
      'article-ancien',
      'article-brouillon',
      'article-publie',
    ])
  })

  it('brings the dates back as timestamps, not as strings', async () => {
    await seedTestData(db)
    // Through JSON, which is what an archive really goes through.
    const archive = JSON.parse(JSON.stringify(await buildExport()))

    await applyImport(archive, { wipe: true })

    const [row] = await db.select().from(article)
    expect(row?.createdAt).toBeInstanceOf(Date)
    const published = (await db.select().from(article)).find((a) => a.publishedAt)
    expect(published?.publishedAt).toBeInstanceOf(Date)
  })

  it('counts zero for an empty section without failing on it', async () => {
    const written = await applyImport(emptyArchive() as never, { wipe: false })
    expect(written.views).toBe(0)
    expect(written.articles).toBe(0)
  })

  it('moves the sequences past the highest restored identifier', async () => {
    // Without this, the next creation restarts at 1 and collides with a
    // restored row — a failure that would only surface much later.
    const archive = {
      ...emptyArchive(),
      articles: [{ id: 500, slug: 'restaure', title: 'Restauré', status: 'draft' }],
      tags: [{ id: 42, slug: 'restaure', label: 'Restauré' }],
    }
    await applyImport(archive as never, { wipe: true })

    const [fresh] = await db
      .insert(article)
      .values({ slug: 'nouveau', title: 'Nouveau' })
      .returning({ id: article.id })
    const [freshTag] = await db
      .insert(tag)
      .values({ slug: 'neuf', label: 'Neuf' })
      .returning({ id: tag.id })

    expect(fresh?.id).toBe(501)
    expect(freshTag?.id).toBe(43)
  })

  it('moves the sequences even when nothing was imported', async () => {
    await applyImport(emptyArchive() as never, { wipe: true })
    const [fresh] = await db
      .insert(article)
      .values({ slug: 'premier', title: 'Premier' })
      .returning({ id: article.id })
    expect(fresh?.id).toBe(1)
  })

  it('ignores a row already present rather than failing the whole import', async () => {
    await seedTestData(db)
    const archive = await buildExport()
    // Replayed onto a base that already holds it: onConflictDoNothing.
    await expect(applyImport(archive as never, { wipe: false })).resolves.toBeDefined()
    expect(await db.select().from(article)).toHaveLength(3)
  })
})
