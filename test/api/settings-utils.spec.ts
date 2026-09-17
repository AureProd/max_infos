import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The settings helpers, against a REAL database.
 *
 * Faking the drizzle chain would test the fake: what matters here is the
 * `onConflictDoUpdate` on a unique index — which CLAUDE.md lists as failing
 * at runtime only — and the scope written alongside the value.
 *
 * `setup()` is deliberately NOT called: no Nitro server, so this file runs
 * inside the vitest process and its coverage counts.
 */

let sqlClient: postgres.Sql
let db: TestDatabase

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))

const { readSetting, writeSetting } = await import('../../server/utils/settings')
const { setting, appUser } = await import('../../server/database/schema')

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

let author = 0

beforeEach(async () => {
  await sqlClient.unsafe('truncate table setting, app_user restart identity cascade')
  const [u] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  author = u?.id ?? 0
})

describe('readSetting', () => {
  it('falls back on the defaults when nothing has been written', async () => {
    // A site whose settings have never been filled in must still render.
    const identity = await readSetting('identity')
    expect(identity.name).toBe("Un Max d'info")
  })

  it('falls back on the defaults rather than throwing on a malformed value', async () => {
    // A hand-edited row, or one left behind by an older schema, must not
    // take the page down with it.
    await db.insert(setting).values({ key: 'identity', value: { name: 42 }, scope: 'public' })
    expect((await readSetting('identity')).name).toBe("Un Max d'info")
  })

  it('gives back what was stored when it is valid', async () => {
    await writeSetting('identity', { name: 'Test', author: 'A', tagline: '', pitch: '' }, author)
    expect((await readSetting('identity')).name).toBe('Test')
  })
})

describe('writeSetting', () => {
  it('takes the scope from the schema, never from the caller', async () => {
    // A client sending scope:'public' on a technical setting would make it
    // visible to everyone. The scope is not a field of the request.
    await writeSetting('instagram', { syncIntervalMinutes: 30, scope: 'public' } as never, author)
    const [row] = await db.select().from(setting)
    expect(row?.scope).toBe('tech')
  })

  it('updates the row rather than duplicating it', async () => {
    // The onConflictDoUpdate targets a unique index; a missing index would
    // only show here.
    await writeSetting('templates', { linkedin: 'un', reel: '' }, author)
    await writeSetting('templates', { linkedin: 'deux', reel: '' }, author)

    const rows = await db.select().from(setting)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toMatchObject({ linkedin: 'deux' })
  })

  it('records who wrote it', async () => {
    await writeSetting('templates', { linkedin: '', reel: '' }, author)
    const [row] = await db.select().from(setting)
    expect(row?.updatedBy).toBe(author)
  })

  it('refuses an invalid value, and writes nothing', async () => {
    await expect(writeSetting('instagram', { syncIntervalMinutes: 1 }, author)).rejects.toThrow()
    expect(await db.select().from(setting)).toHaveLength(0)
  })

  it('gives back the value as validated, defaults filled in', async () => {
    const value = await writeSetting('instagram', {}, author)
    expect(value).toEqual({ syncIntervalMinutes: 60, lastSyncAt: null })
  })
})
