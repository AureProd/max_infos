import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * Restoring a downloaded backup.
 *
 * The site handed out a ZIP and the import accepted nothing but raw JSON:
 * what the Technique screen produced could not be fed back to it, and
 * pulling the production content into a local database was impossible.
 *
 * The archive used here is the one the site ITSELF produces, fetched from
 * /api/admin/export: a test building its own zip would only ever prove that
 * the reader matches the test, not that it matches the export.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''
let archive: ArrayBuffer

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values({ email: 'jb@zip.test', role: 'tech' })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

beforeAll(async () => {
  const [me] = await db.select({ id: appUser.id }).from(appUser)
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: me?.id }),
    headers: { 'content-type': 'application/json' },
  })
  cookie = r.headers.get('set-cookie') ?? ''

  archive = await (await fetch('/api/admin/export', { headers: { cookie } })).arrayBuffer()
})

const send = (query: string) =>
  fetch(`/api/admin/import${query}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/zip' },
    body: archive,
  })

describe('the zip the site itself produced', () => {
  it('is read, and its counts are reported before anything is written', async () => {
    const r = await send('?dryRun=true')
    expect(r.status).toBe(200)
    const summary = await r.json()
    expect(summary.dryRun).toBe(true)
    expect(summary.after.articles).toBeGreaterThan(0)
  })

  it('is applied, and puts the articles back', async () => {
    const r = await send('')
    expect(r.status).toBe(200)
    expect((await r.json()).written.articles).toBeGreaterThan(0)
  })
})

describe('choosing what comes back', () => {
  it('writes only what was asked for', async () => {
    const written = (await (await send('?parts=settings')).json()).written
    expect(written.settings).toBeGreaterThan(0)
    expect(written.articles).toBeUndefined()
    expect(written.users).toBeUndefined()
  })

  it('brings the media along with the articles, which point at them', async () => {
    // A cover is a foreign key: restoring the articles alone breaks halfway
    // through, on an insert, long after the boxes were ticked.
    const written = (await (await send('?parts=articles')).json()).written
    expect(written.media).toBeDefined()
    expect(written.tags).toBeDefined()
  })
})

describe('what it refuses', () => {
  it('rejects a file that is not an archive', async () => {
    const r = await fetch('/api/admin/import?dryRun=true', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/zip' },
      body: new TextEncoder().encode('ceci est un texte'),
    })
    expect(r.status).toBe(422)
  })

  it('rejects an empty body', async () => {
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/zip' },
      body: new Uint8Array(),
    })
    expect(r.status).toBe(400)
  })

  it('refuses an editor: restoring is a technical act', async () => {
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: archive,
    })
    expect(r.status).toBe(401)
  })

  it('still accepts the JSON the command line sends', async () => {
    const summary = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: { cookie },
      body: { archive: { manifest: { version: 2, counts: {} } }, dryRun: true },
    })
    expect(summary.dryRun).toBe(true)
  })
})
