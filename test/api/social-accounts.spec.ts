import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * The social accounts as seen from the back-office.
 *
 * This is the Social screen at play: Max connects, orders, hides,
 * disconnects. The tests are about what he observes — the home page changes
 * — and not about the shape of the requests.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let editor = 0

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  const [e] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  editor = e?.id ?? 0
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

async function cookieEditeur(): Promise<string> {
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: editor }),
    headers: { 'content-type': 'application/json' },
  })
  return r.headers.get('set-cookie') ?? ''
}

describe('GET /api/admin/social-accounts', () => {
  it('ALSO shows the hidden accounts — otherwise they can never be shown again', async () => {
    const accounts = await $fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    expect(accounts.map((c) => c.username)).toEqual(['maxinfo', 'archives'])
    expect(accounts.find((c) => c.username === 'archives')?.visible).toBe(false)
  })

  it('says how many posts each account would take with it', async () => {
    // The screen warns before disconnecting: the deletion is final.
    const accounts = await $fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    expect(accounts.find((c) => c.username === 'maxinfo')?.nbPublications).toBe(3)
    expect(accounts.find((c) => c.username === 'archives')?.nbPublications).toBe(1)
  })

  it('reports that an account has no token, without ever showing it', async () => {
    const r = await fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    const raw = await r.text()
    expect(raw).not.toContain('ciphertext')
    expect(JSON.parse(raw)[0].signedIn).toBe(false)
  })
})

describe('PUT /api/admin/social-accounts/[id]', () => {
  it('changes the order of the home page sections', async () => {
    const cookie = await cookieEditeur()
    const accounts = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const max = accounts.find((c) => c.username === 'maxinfo')
    const archives = accounts.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { visible: true, position: 0 },
    })
    await $fetch(`/api/admin/social-accounts/${max?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { position: 1 },
    })

    expect((await $fetch('/api/social-accounts')).map((c) => c.username)).toEqual([
      'archives',
      'maxinfo',
    ])
  })

  it('changes the number of posts shown', async () => {
    const cookie = await cookieEditeur()
    const accounts = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const max = accounts.find((c) => c.username === 'maxinfo')

    await $fetch(`/api/admin/social-accounts/${max?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { postsOnHome: 2 },
    })

    const section = (await $fetch('/api/social-accounts')).find((c) => c.username === 'maxinfo')
    expect(section?.publications.map((p) => p.shortcode)).toEqual(['ABC123', 'DEF456'])
  })

  it('removes the section from the home page when Max hides it', async () => {
    const cookie = await cookieEditeur()
    const accounts = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const archives = accounts.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { visible: false },
    })

    expect((await $fetch('/api/social-accounts')).map((c) => c.username)).toEqual(['maxinfo'])
  })

  it('refuses an absurd post count', async () => {
    const r = await fetch('/api/admin/social-accounts/1', {
      method: 'PUT',
      headers: { cookie: await cookieEditeur(), 'content-type': 'application/json' },
      body: JSON.stringify({ postsOnHome: 0 }),
    })
    expect(r.status).toBe(400)
  })
})

describe('DELETE /api/admin/social-accounts/[id]', () => {
  it('takes the account, its posts and its token', async () => {
    const cookie = await cookieEditeur()
    const accounts = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const archives = accounts.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    const remaining = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    expect(remaining.map((c) => c.username)).toEqual(['maxinfo'])
    // MASQ1 belonged to the deleted account.
    expect((await $fetch('/api/social-posts')).map((p) => p.shortcode)).not.toContain('MASQ1')
  })

  it('answers 404 on an unknown account, without breaking anything', async () => {
    const r = await fetch('/api/admin/social-accounts/999999', {
      method: 'DELETE',
      headers: { cookie: await cookieEditeur() },
    })
    expect(r.status).toBe(404)
  })
})
