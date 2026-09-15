import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * Managing the accounts allowed to sign in.
 *
 * Google authenticates; this list AUTHORISES. Two things can only be proved
 * against a real database: that an invitation is recognised by the very
 * login flow it was written for, and that the unique index on lower(email)
 * refuses a duplicate typed in another case.
 *
 * `setup()` is deliberately NOT called: no Nitro server, so this file runs
 * inside the vitest process and its coverage counts.
 */

let sqlClient: postgres.Sql
let db: TestDatabase
let session: { user?: { id?: number } } = {}

vi.mock('~~/server/database/client', () => ({ useDatabase: () => db }))
vi.stubGlobal('getUserSession', async () => session)
vi.stubGlobal('useRuntimeConfig', () => ({ bootstrapTechEmail: '' }))
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { inviteUser, changeUser, removeUser } = await import('../../server/utils/users')
const { signInOrReject, currentUser } = await import('../../server/utils/auth')
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
})

const techId = async (email = 'jb@exemple.test') => (await inviteUser(email, 'tech')).id

describe('inviting', () => {
  it('writes the row a first login will recognise, and nothing more', async () => {
    const invited = await inviteUser('max@exemple.test', 'editor')

    expect(invited).toMatchObject({ email: 'max@exemple.test', role: 'editor', active: true })
    // Neither name nor picture: they come from Google, on the first login.
    const [row] = await db.select().from(appUser).where(eq(appUser.id, invited.id))
    expect(row?.name).toBeNull()
    expect(row?.lastLoginAt).toBeNull()
  })

  it('is recognised by the login flow it was written for', async () => {
    // THE assertion of the whole feature: inviting is writing the row ahead
    // of time, and signInOrReject does the rest without a line of new code.
    await inviteUser('max@exemple.test', 'editor')

    const signed = await signInOrReject({ email: 'max@exemple.test', name: 'Max' })

    expect(signed).toMatchObject({ email: 'max@exemple.test', role: 'editor', name: 'Max' })
    // Completed, not duplicated.
    expect(await db.select().from(appUser)).toHaveLength(1)
  })

  it('recognises the invitation whatever case Google sends', async () => {
    await inviteUser('Max@Exemple.test', 'editor')
    await signInOrReject({ email: 'max@exemple.test' })
    expect(await db.select().from(appUser)).toHaveLength(1)
  })

  it('refuses an address already invited in another case', async () => {
    // The unique index is on lower(email): this test exercises the INDEX,
    // not the code around it.
    await inviteUser('max@exemple.test', 'editor')
    await expect(inviteUser('MAX@EXEMPLE.TEST', 'tech')).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(await db.select().from(appUser)).toHaveLength(1)
  })

  it('leaves an unknown address refused, as before', async () => {
    await expect(signInOrReject({ email: 'inconnu@exemple.test' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})

describe('changing an account', () => {
  it('switches the role', async () => {
    const jb = await techId()
    const max = (await inviteUser('max@exemple.test', 'editor')).id

    expect(await changeUser(jb, max, { role: 'tech' })).toMatchObject({ role: 'tech' })
  })

  it('cuts the access, which takes effect on the very next request', async () => {
    // currentUser re-reads `active` every time: this is what makes revoking
    // an access immediate rather than fourteen days away.
    const jb = await techId()
    const max = (await inviteUser('max@exemple.test', 'editor')).id
    session = { user: { id: max } }
    expect(await currentUser(event)).not.toBeNull()

    await changeUser(jb, max, { active: false })

    expect(await currentUser(event)).toBeNull()
  })

  it('answers 404 on an account that does not exist', async () => {
    const jb = await techId()
    await expect(changeUser(jb, 999_999, { active: false })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('the two guard rails', () => {
  it('refuses to let a tech touch their own access', async () => {
    // THE one that prevents a lockout on a two-account site. Getting back in
    // would mean going through NUXT_BOOTSTRAP_TECH_EMAIL, on the VPS.
    const jb = await techId()

    await expect(changeUser(jb, jb, { active: false })).rejects.toMatchObject({ statusCode: 409 })
    await expect(changeUser(jb, jb, { role: 'editor' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(removeUser(jb, jb)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('lets a tech change something harmless about themselves', async () => {
    // The guard rail is about ACCESS, not about the row.
    const jb = await techId()
    await expect(changeUser(jb, jb, {})).resolves.toMatchObject({ id: jb })
  })

  it('refuses to strip the last active tech, whoever asks', async () => {
    // Belt and braces: « not yourself » already makes a lockout unreachable
    // through the routes. This one holds even for a caller that forgets to
    // pass the actor — a script, a future route.
    const jb = await techId()
    const other = await techId('autre@exemple.test')
    // Two techs: the second can lose the role.
    await changeUser(jb, other, { role: 'editor' })

    // Only one left, and it is not the actor.
    await expect(changeUser(other, jb, { role: 'editor' })).rejects.toMatchObject({
      statusCode: 409,
    })
    await expect(changeUser(other, jb, { active: false })).rejects.toMatchObject({
      statusCode: 409,
    })
    await expect(removeUser(other, jb)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not count a deactivated tech as a survivor', async () => {
    // A tech who can no longer sign in protects nothing.
    const jb = await techId()
    const dormant = await techId('dormant@exemple.test')
    await changeUser(jb, dormant, { active: false })

    await expect(changeUser(dormant, jb, { role: 'editor' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('lets the second-to-last tech go', async () => {
    // The rule protects the LAST one, not every one of them.
    const jb = await techId()
    const other = await techId('autre@exemple.test')
    await expect(removeUser(jb, other)).resolves.toMatchObject({ id: other })
  })
})

describe('removing an account', () => {
  it('deletes the row and frees the address', async () => {
    const jb = await techId()
    const max = (await inviteUser('max@exemple.test', 'editor')).id

    await removeUser(jb, max)

    expect(await db.select().from(appUser)).toHaveLength(1)
    // The address can be invited again: no ghost left behind.
    await expect(inviteUser('max@exemple.test', 'editor')).resolves.toMatchObject({
      email: 'max@exemple.test',
    })
  })

  it('answers 404 rather than pretending', async () => {
    const jb = await techId()
    await expect(removeUser(jb, 999_999)).rejects.toMatchObject({ statusCode: 404 })
  })
})
