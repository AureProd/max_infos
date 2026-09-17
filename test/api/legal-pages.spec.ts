import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connection, migrate } from '../setup/db'

/**
 * The legal pages. Two reasons for them to exist, and only one is French
 * law: the Meta console refuses to switch the app to Live without a
 * publicly reachable privacy policy URL, and without a data deletion URL.
 *
 * What is pasted into that console is therefore an ADDRESS this test
 * guards — a heading id renamed in passing would invalidate a declaration
 * made to Meta, and nothing on the site would look broken.
 */
let sqlClient: postgres.Sql

beforeAll(async () => {
  // The default layout renders the footer, which reads /api/site: without
  // the schema the pages would answer 500 for a reason that has nothing to
  // do with what is being tested.
  sqlClient = connection()
  await migrate(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

describe('the legal pages answer', () => {
  it.each(['/privacy', '/legal', '/terms'])('%s answers 200', async (path) => {
    expect((await fetch(path)).status).toBe(200)
  })

  it.each(['/privacy', '/legal', '/terms'])('%s is indexable', async (path) => {
    // Meta's robot must reach the policy. A noindex inherited by accident
    // would not stop a human, and would stop the review.
    const r = await fetch(path)
    // Asserted together: a 404 carries no noindex either, and would let
    // this pass while proving nothing.
    expect(r.status).toBe(200)
    expect(r.headers.get('x-robots-tag')).toBeNull()
    expect(await r.text()).not.toContain('noindex')
  })
})

describe('the privacy policy', () => {
  it('carries the data-deletion anchor pasted into the Meta console', async () => {
    const html = await $fetch<string>('/privacy')
    expect(html).toContain('id="data-deletion"')
  })

  it('names every processor the site actually relies on', async () => {
    const html = await $fetch<string>('/privacy')
    for (const processor of ['Hetzner', 'Cloudflare', 'Meta', 'Google'])
      expect(html).toContain(processor)
  })

  it('gives an address to write to', async () => {
    expect(await $fetch<string>('/privacy')).toContain('maxhuetytb@gmail.com')
  })

  it('states that the site never publishes', async () => {
    // A read-only scope is what was declared to Meta. The page must say so.
    expect(await $fetch<string>('/privacy')).toContain('ne publie jamais')
  })
})

describe('the legal notice', () => {
  it('names the publisher and the host', async () => {
    const html = await $fetch<string>('/legal')
    expect(html).toContain('Maximilien Huet')
    expect(html).toContain('Hetzner')
    expect(html).toContain('Gunzenhausen')
  })
})

describe('the sitemap', () => {
  it.each(['/privacy', '/legal', '/terms'])('lists %s', async (path) => {
    expect(await (await fetch('/sitemap.xml')).text()).toContain(`<loc>`)
    expect(await (await fetch('/sitemap.xml')).text()).toContain(`${path}</loc>`)
  })
})

describe('the footer', () => {
  it('leads to the three pages from any page', async () => {
    const html = await $fetch<string>('/about')
    for (const path of ['/privacy', '/legal', '/terms']) expect(html).toContain(`href="${path}"`)
  })
})
