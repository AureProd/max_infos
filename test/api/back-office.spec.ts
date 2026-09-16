import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * Do the back-office screens actually render?
 *
 * A page that compiles is not a page that renders: a composable called
 * wrongly, a missing setting or an unexpected response type takes it down
 * with a 500, and nothing before this test would show it.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
const cookies: Record<'editor' | 'tech', string> = { editor: '', tech: '' }

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values([
    { email: 'max@bo.test', role: 'editor' },
    { email: 'jb@bo.test', role: 'tech' },
  ])
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

beforeAll(async () => {
  const accounts = await db.select({ id: appUser.id, role: appUser.role }).from(appUser)
  for (const c of accounts) {
    if (c.role !== 'editor' && c.role !== 'tech') continue
    const r = await fetch('/api/test/session', {
      method: 'POST',
      body: JSON.stringify({ id: c.id }),
      headers: { 'content-type': 'application/json' },
    })
    cookies[c.role] = r.headers.get('set-cookie') ?? ''
  }
})

const EDITOR_SCREENS = ['/admin', '/admin/articles', '/admin/publications', '/admin/about']

describe('access', () => {
  it.each([...EDITOR_SCREENS, '/admin/tech'])(
    '%s redirige vers la connexion sans session',
    async (path) => {
      const r = await fetch(path, { redirect: 'manual' })
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toContain('/login')
    },
  )
})

describe('rendering for an editor', () => {
  it.each(EDITOR_SCREENS)('%s s’affiche', async (path) => {
    const r = await fetch(path, { headers: { cookie: cookies.editor } })
    expect(r.status).toBe(200)
    const html = await r.text()
    // A Nuxt page in error answers 200 with its error page: so we check the
    // CONTENT, not just the status code.
    expect(html).not.toContain('statusCode:500')
    // `admin-shell` is the root of layouts/admin.vue: its presence proves
    // the back-office chrome was rendered, not an error page.
    expect(html).toContain('admin-shell')
  })

  it('the menu does NOT offer the tech screen', async () => {
    // Comfort hiding: security remains the server's refusal, checked by
    // test/api/authorization.spec.ts.
    const html = await (await fetch('/admin', { headers: { cookie: cookies.editor } })).text()
    expect(html).not.toContain('/admin/tech')
  })
})

describe('rendering for a tech', () => {
  it('the tech screen renders', async () => {
    const r = await fetch('/admin/tech', { headers: { cookie: cookies.tech } })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('admin-shell')
  })

  it('the menu offers the tech screen', async () => {
    const html = await (await fetch('/admin', { headers: { cookie: cookies.tech } })).text()
    expect(html).toContain('/admin/tech')
  })
})

describe('article editor', () => {
  it('renders on an existing article', async () => {
    const r = await fetch('/admin/article-publie', { headers: { cookie: cookies.editor } })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Un article publié')
  })
})

/**
 * The sign-in failure banner.
 *
 * The page reads a query parameter that the OAuth handler writes. Two
 * places, one name: nothing forces them to agree, and a rename broke the
 * match once — the banner then existed without ever being able to show.
 */
describe('sign-in failure', () => {
  it('shows the banner when the OAuth handler sends one back', async () => {
    const html = await (await fetch('/login?signin=failed')).text()
    expect(html).toContain('La connexion a échoué')
  })

  it('shows nothing without the parameter', async () => {
    const html = await (await fetch('/login')).text()
    expect(html).not.toContain('La connexion a échoué')
  })
})
