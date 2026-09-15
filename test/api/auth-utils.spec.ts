import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The authorization helpers, against a REAL database.
 *
 * The H3 event is never dereferenced — it is handed straight to
 * getUserSession — so an empty object is enough. What cannot be faked is the
 * case-insensitive match against the unique index on lower(email), and the
 * re-read of the role on every request.
 */

let sqlClient: postgres.Sql
let db: TestDatabase
let session: { user?: { id?: number } } = {}
let bootstrapTechEmail = ''

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))
vi.stubGlobal('getUserSession', async () => session)
vi.stubGlobal('useRuntimeConfig', () => ({ bootstrapTechEmail }))
// The stub CARRIES the status code: 401 and 403 do not say the same thing,
// and an error that forgot its code would make the two indistinguishable.
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { currentUser, requireSignIn, requireRole, signInOrReject } = await import(
  '../../server/utils/auth'
)
const { appUser } = await import('../../server/database/schema')

const event = {} as H3Event

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe('truncate table app_user restart identity cascade')
  session = {}
  bootstrapTechEmail = ''
})

const insert = async (values: Partial<typeof appUser.$inferInsert> & { email: string }) => {
  const [row] = await db.insert(appUser).values(values).returning({ id: appUser.id })
  return row?.id ?? 0
}

describe('currentUser', () => {
  it('answers null without a session', async () => {
    expect(await currentUser(event)).toBeNull()
  })

  it('answers null for a session pointing at a deleted account', async () => {
    session = { user: { id: 9999 } }
    expect(await currentUser(event)).toBeNull()
  })

  it('answers null for a disabled account, without waiting for expiry', async () => {
    // This is the whole reason the role is re-read: a session lasts fourteen
    // days, and disabling an account must take effect at once.
    session = { user: { id: await insert({ email: 'a@exemple.test', active: false }) } }
    expect(await currentUser(event)).toBeNull()
  })

  it('gives back the identity, and not the active flag', async () => {
    const id = await insert({ email: 'max@exemple.test', name: 'Max', role: 'editor' })
    session = { user: { id } }

    const user = await currentUser(event)
    expect(user).toEqual({
      id,
      email: 'max@exemple.test',
      name: 'Max',
      avatarUrl: null,
      role: 'editor',
    })
  })
})

describe('requireSignIn', () => {
  it('answers 401, not 403: the client can still sign in', async () => {
    await expect(requireSignIn(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('lets a valid session through', async () => {
    session = { user: { id: await insert({ email: 'a@exemple.test' }) } }
    await expect(requireSignIn(event)).resolves.toMatchObject({ email: 'a@exemple.test' })
  })
})

describe('requireRole', () => {
  it('lets a tech through everywhere', async () => {
    session = { user: { id: await insert({ email: 't@exemple.test', role: 'tech' }) } }
    await expect(requireRole(event, 'editor')).resolves.toMatchObject({ role: 'tech' })
    await expect(requireRole(event, 'tech')).resolves.toMatchObject({ role: 'tech' })
  })

  it('answers 403 to an editor asking for the technical scope', async () => {
    session = { user: { id: await insert({ email: 'e@exemple.test', role: 'editor' }) } }
    await expect(requireRole(event, 'editor')).resolves.toMatchObject({ role: 'editor' })
    await expect(requireRole(event, 'tech')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('answers 401 without a session, before even looking at the role', async () => {
    await expect(requireRole(event, 'editor')).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('signInOrReject', () => {
  it('refuses an unknown address: nobody signs themselves up', async () => {
    // The allow list is the single most important assertion of this file.
    await expect(signInOrReject({ email: 'inconnu@exemple.test' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(await db.select().from(appUser)).toHaveLength(0)
  })

  it('refuses everything when no bootstrap address is configured', async () => {
    bootstrapTechEmail = '   '
    await expect(signInOrReject({ email: 'qui@exemple.test' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('creates the bootstrap account, whatever the case Google sends', async () => {
    bootstrapTechEmail = 'JB@exemple.test'
    const user = await signInOrReject({ email: 'jb@exemple.test', name: 'JB' })

    expect(user).toMatchObject({ email: 'jb@exemple.test', role: 'tech', name: 'JB' })
    expect(await db.select().from(appUser)).toHaveLength(1)
  })

  it('matches an existing account regardless of case, and creates nothing', async () => {
    // Google returns the address with varying case; the unique index is on
    // lower(email), and this is what exercises the raw SQL against it.
    await insert({ email: 'Max@Exemple.test', name: 'Max', role: 'editor' })
    const user = await signInOrReject({ email: 'max@exemple.test' })

    expect(user.email).toBe('Max@Exemple.test')
    expect(await db.select().from(appUser)).toHaveLength(1)
  })

  it('keeps the stored name when Google sends none', async () => {
    await insert({ email: 'max@exemple.test', name: 'Max' })
    expect((await signInOrReject({ email: 'max@exemple.test' })).name).toBe('Max')
  })

  it('takes the new name when Google sends one', async () => {
    await insert({ email: 'max@exemple.test', name: 'Max' })
    expect((await signInOrReject({ email: 'max@exemple.test', name: 'Maximilien' })).name).toBe(
      'Maximilien',
    )
  })

  it('stamps the sign-in date', async () => {
    const id = await insert({ email: 'max@exemple.test' })
    await signInOrReject({ email: 'max@exemple.test' })

    const [row] = await db.select().from(appUser).where(eq(appUser.id, id))
    expect(row?.lastLoginAt).toBeInstanceOf(Date)
  })

  it('refuses a disabled account with 403, and does not resurrect it', async () => {
    await insert({ email: 'ancien@exemple.test', active: false })
    bootstrapTechEmail = 'ancien@exemple.test'

    await expect(signInOrReject({ email: 'ancien@exemple.test' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
