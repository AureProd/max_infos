import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, tag } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * Housekeeping the subjects.
 *
 * Every misspelling used to create one more tag, and nothing ever removed
 * it: the list of « déjà utilisés » grew with the mistakes and there was no
 * way back. A subject attached to no article can now be deleted — and only
 * that one, because deleting a subject in use would silently strip it off
 * the articles carrying it.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values({ email: 'max@tags.test', role: 'editor' })
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
})

describe('GET /api/admin/tags', () => {
  it('says how many articles carry each subject', async () => {
    const tags = await $fetch('/api/admin/tags', { headers: { cookie } })
    expect(tags.find((t) => t.slug === 'geo')?.n).toBe(1)
  })
})

describe('PUT /api/admin/tags/[slug]', () => {
  it('corrects the spelling, and the address follows', async () => {
    await db.insert(tag).values({ slug: 'scootisme', label: 'scootisme' })
    const renamed = await $fetch('/api/admin/tags/scootisme', {
      method: 'PUT',
      headers: { cookie },
      body: { label: 'Scoutisme' },
    })
    expect(renamed.label).toBe('Scoutisme')
    // The slug is what the public filter carries in its URL: leaving the
    // typo there would keep it visible for good.
    expect(renamed.slug).toBe('scoutisme')
  })

  it('keeps the articles that carried it', async () => {
    // The link is made by identifier, not by label: renaming must not
    // quietly strip the subject off the articles.
    await $fetch('/api/admin/tags/geo', {
      method: 'PUT',
      headers: { cookie },
      body: { label: 'Géographie et cartes' },
    })
    const tags = await $fetch('/api/admin/tags', { headers: { cookie } })
    expect(tags.find((t) => t.label === 'Géographie et cartes')?.n).toBe(1)
  })

  it('REFUSES a name another subject already bears', async () => {
    // Merging two subjects is another operation entirely. Silently
    // colliding would lose one of them.
    await db.insert(tag).values([
      { slug: 'alpha-un', label: 'Alpha un' },
      { slug: 'alpha-deux', label: 'Alpha deux' },
    ])
    const r = await fetch('/api/admin/tags/alpha-deux', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Alpha un' }),
    })
    expect(r.status).toBe(409)
  })

  it('refuses a name that produces no slug at all', async () => {
    const r = await fetch('/api/admin/tags/alpha-un', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label: '«  »' }),
    })
    expect(r.status).toBe(422)
  })

  it('answers 404 on a subject that does not exist', async () => {
    const r = await fetch('/api/admin/tags/jamais-vu', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Peu importe' }),
    })
    expect(r.status).toBe(404)
  })

  it('refuses a visitor who is not signed in', async () => {
    const r = await fetch('/api/admin/tags/geo', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Pirate' }),
    })
    expect(r.status).toBe(401)
  })
})

describe('DELETE /api/admin/tags/[slug]', () => {
  it('removes a subject no article carries', async () => {
    // Inserted straight into the database: no screen creates a bare tag —
    // one is born by being typed on an article, and orphaned when the last
    // article carrying it drops it.
    await db.insert(tag).values({ slug: 'orphelin', label: 'Orphelin' })
    const before = await $fetch('/api/admin/tags', { headers: { cookie } })
    expect(before.some((t) => t.label === 'Orphelin')).toBe(true)

    await $fetch('/api/admin/tags/orphelin', { method: 'DELETE', headers: { cookie } })

    const after = await $fetch('/api/admin/tags', { headers: { cookie } })
    expect(after.some((t) => t.label === 'Orphelin')).toBe(false)
  })

  it('REFUSES to delete a subject still in use', async () => {
    // Deleting it would strip it off the articles carrying it, without a
    // word and without a way back.
    // « mem » and not « geo »: the rename test above moves that one, and a
    // test that depends on the order of another is a test that will lie.
    const r = await fetch('/api/admin/tags/mem', { method: 'DELETE', headers: { cookie } })
    expect(r.status).toBe(409)

    const tags = await $fetch('/api/admin/tags', { headers: { cookie } })
    expect(tags.some((t) => t.slug === 'mem')).toBe(true)
  })

  it('answers 404 on a subject that does not exist', async () => {
    const r = await fetch('/api/admin/tags/jamais-vu', { method: 'DELETE', headers: { cookie } })
    expect(r.status).toBe(404)
  })

  it('refuses a visitor who is not signed in', async () => {
    expect((await fetch('/api/admin/tags/orphelin', { method: 'DELETE' })).status).toBe(401)
  })
})
