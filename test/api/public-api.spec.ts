import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTING_SCOPE, type SettingKey } from '#shared/schemas/settings'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * The public API, against a REAL database.
 *
 * The « one rolled-back transaction per test » pattern does not hold here:
 * the Nitro handler opens its own connections and would see nothing a test
 * transaction had written. So we seed once, before the server starts, and
 * the tests only read — except the view counter, which checks a write
 * precisely.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

describe('GET /api/articles', () => {
  it('returns only the published articles', async () => {
    const r = await $fetch('/api/articles')
    expect(r.total).toBe(2)
    // The draft must appear nowhere: it is not « forbidden », it does not
    // exist for the public.
    expect(r.items.map((i) => i.slug)).not.toContain('article-brouillon')
  })

  it('sorts newest first', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items.map((i) => i.slug)).toEqual(['article-publie', 'article-ancien'])
  })

  it('renders the date as a day only, without time or zone', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items[0]?.publishedAt).toBe('2026-09-10')
  })

  it('joins the cover and the tags', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items[0]?.coverUrl).toContain('cover.png')
    expect(r.items[0]?.tags).toEqual([{ slug: 'geo', label: 'Géographie' }])
  })

  it('filters by tag without skewing the total', async () => {
    const r = await $fetch('/api/articles', { query: { tag: 'geo' } })
    expect(r.total).toBe(1)
    expect(r.items[0]?.slug).toBe('article-publie')
  })

  it('searches the body, not only the title', async () => {
    const r = await $fetch('/api/articles', { query: { q: 'zzyzx' } })
    expect(r.items.map((i) => i.slug)).toEqual(['article-publie'])
  })

  it('paginates', async () => {
    const p1 = await $fetch('/api/articles', { query: { size: 1, page: 1 } })
    const p2 = await $fetch('/api/articles', { query: { size: 1, page: 2 } })
    expect(p1.items).toHaveLength(1)
    expect(p2.items).toHaveLength(1)
    expect(p1.items[0]?.slug).not.toBe(p2.items[0]?.slug)
    // The total describes the whole set, not the page.
    expect(p1.total).toBe(2)
  })

  it('refuses an out-of-bounds query with 400, not 500', async () => {
    for (const q of ['?size=500', '?page=0', '?q=']) {
      expect((await fetch(`/api/articles${q}`)).status).toBe(400)
    }
  })
})

describe('GET /api/articles/[slug]', () => {
  it('returns the article, its tags and its variants', async () => {
    const a = await $fetch('/api/articles/article-publie')
    expect(a.title).toBe('Un article publié')
    expect(a.tags.map((t) => t.slug)).toEqual(['geo'])
    expect(a.variants.map((d) => d.shortcode)).toEqual(['ABC123'])
  })

  it('answers 404 on a draft, not 403', async () => {
    // A 403 would confirm the draft's existence.
    expect((await fetch('/api/articles/article-brouillon')).status).toBe(404)
  })

  it('answers 404 on an unknown article', async () => {
    expect((await fetch('/api/articles/jamais-vu')).status).toBe(404)
  })

  it('answers 400 on a malformed slug, not 500', async () => {
    for (const s of ['Majuscule', '..%2Fetc%2Fpasswd', 'deux--tirets']) {
      expect((await fetch(`/api/articles/${s}`)).status).toBe(400)
    }
  })
})

describe('GET /api/tags', () => {
  it('counts the published articles and sorts the French way', async () => {
    const tags = await $fetch('/api/tags')
    // « Alpha » before « Géographie »: that is the localeCompare sort, run
    // in JavaScript so as not to depend on the PostgreSQL image's locales.
    expect(tags.map((t) => t.label)).toEqual(['Alpha', 'Géographie'])
    expect(tags.every((t) => t.n === 1)).toBe(true)
  })
})

describe('GET /api/social-posts', () => {
  it('hides the hidden posts', async () => {
    const posts = await $fetch('/api/social-posts')
    // MASQ1 is there: it belongs to a hidden account, which removes it from
    // the HOME PAGE, not from the general list. The two notions are
    // distinct.
    expect(posts.map((p) => p.shortcode)).toEqual(['MAIN1', 'ABC123', 'DEF456', 'MASQ1'])
  })

  // The home page renders one section per ACCOUNT. A post belonging to none
  // had nowhere to appear at all: three sat invisible in production from
  // 15/09/2026.
  it('isolates the posts that belong to no account', async () => {
    const posts = await $fetch('/api/social-posts', { query: { account: 'none' } })
    expect(posts.map((p) => p.shortcode)).toEqual(['MAIN1'])
  })

  // The distinction that matters: `source` says where a post CAME FROM and
  // defaults to `manual`, so filtering on it would also return posts an
  // account section already shows — the same post twice on the home page.
  it('does not mistake provenance for placement', async () => {
    const posts = await $fetch('/api/social-posts', { query: { account: 'none' } })
    expect(posts.map((p) => p.shortcode)).not.toContain('DEF456')
    expect(posts.map((p) => p.shortcode)).not.toContain('MASQ1')
  })

  // Hiding wins over everything: it is the one lever Max has to take a post
  // off the site without deleting it.
  it('still hides the hidden ones when filtering', async () => {
    const posts = await $fetch('/api/social-posts', { query: { account: 'none' } })
    expect(posts.map((p) => p.shortcode)).not.toContain('CACHE1')
  })

  it('refuses an unknown account filter', async () => {
    expect((await fetch('/api/social-posts?account=42')).status).toBe(400)
  })

  // The point of the whole filter, checked where it matters: on the page.
  // Answering correctly from the API while showing nothing is exactly the
  // failure that shipped.
  it('shows them on the home page, which renders sections per account', async () => {
    const html = await (await fetch('/')).text()
    expect(html).toContain('Publication ajoutée à la main')
    expect(html).toContain('Sur les réseaux')
  })

  it("NEVER exposes Meta's payload", async () => {
    const raw = await (await fetch('/api/social-posts')).text()
    expect(raw).not.toContain('raw')
    expect(raw).not.toContain('secret_meta')
  })

  it('filters by article', async () => {
    const posts = await $fetch('/api/social-posts', { query: { article: 'article-publie' } })
    expect(posts).toHaveLength(1)
    expect(
      (await $fetch('/api/social-posts', { query: { article: 'article-ancien' } })).length,
    ).toBe(0)
  })

  it('refuses an unknown network', async () => {
    expect((await fetch('/api/social-posts?network=mastodon')).status).toBe(400)
  })
})

describe('GET /api/social-accounts', () => {
  it('returns only the accounts shown on the home page', async () => {
    const accounts = await $fetch('/api/social-accounts')
    expect(accounts.map((c) => c.username)).toEqual(['maxinfo'])
  })

  it('takes the account identity as Instagram gives it', async () => {
    // That is the design decision: the section's label and picture come
    // from the connected account, they are not typed in.
    const [account] = await $fetch('/api/social-accounts')
    expect(account?.displayName).toBe('Un Max d’info')
    expect(account?.avatarUrl).toBe('https://exemple.test/avatar.png')
    expect(account?.url).toBe('https://www.instagram.com/maxinfo')
    expect(account?.followers).toBe(120)
  })

  it('truncates to the chosen post count, newest first', async () => {
    const [account] = await $fetch('/api/social-accounts')
    // postsOnHome is 1 in the test data: DEF456, being older, stays out.
    expect(account?.publications.map((p) => p.shortcode)).toEqual(['ABC123'])
  })

  it('shows neither a hidden post nor a post of a hidden account', async () => {
    const raw = await (await fetch('/api/social-accounts')).text()
    expect(raw).not.toContain('CACHE1')
    expect(raw).not.toContain('MASQ1')
    expect(raw).not.toContain('archives')
  })

  it("exposes neither Meta's payload nor any token", async () => {
    const raw = await (await fetch('/api/social-accounts')).text()
    expect(raw).not.toContain('secret_meta')
    expect(raw).not.toContain('ciphertext')
    expect(raw).not.toContain('access_token')
  })
})

describe('GET /api/site', () => {
  it('returns the public settings', async () => {
    const site = await $fetch<Record<string, { name?: string }>>('/api/site')
    expect(site.identity?.name).toBe('Site de test')
  })

  it('returns a default for a setting never saved', async () => {
    // A site whose CV is not filled in must render, not fail.
    const site = await $fetch<Record<string, unknown>>('/api/site')
    expect(site.cv).toBeDefined()
    expect(site.seo).toBeDefined()
  })

  it('NEVER leaks a technical setting', async () => {
    // The worst risk of the project according to the plan: that Max — or
    // anyone — sees what belongs to the infrastructure.
    //
    // We ENUMERATE SETTING_SCOPE rather than search for a substring: the
    // previous version looked for « instagram », which legitimately appears
    // in the PUBLIC key instagram_public. A test aiming at the wrong thing
    // ends up disabled rather than fixed.
    const site = await $fetch<Record<string, unknown>>('/api/site')
    const technical = (Object.keys(SETTING_SCOPE) as SettingKey[]).filter(
      (c) => SETTING_SCOPE[c] === 'tech',
    )
    expect(technical.length).toBeGreaterThan(0)
    for (const key of technical) {
      expect(Object.keys(site), `${key} ne doit pas être public`).not.toContain(key)
    }
    // And the value itself appears nowhere in the response.
    expect(await (await fetch('/api/site')).text()).not.toContain('compte-prive-123')
  })
})

describe('POST /api/articles/[slug]/view', () => {
  it('increments without reading before writing', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await fetch('/api/articles/article-publie/view', { method: 'POST' })
      expect(r.status).toBe(202)
    }
    const [vue] = await sqlClient<{ count: number }[]>`
      select v.count from article_view v
      join article a on a.id = v.article_id
      where a.slug = 'article-publie'`
    expect(vue?.count).toBe(3)
  })

  it('answers 404 on an unknown article', async () => {
    expect((await fetch('/api/articles/jamais-vu/view', { method: 'POST' })).status).toBe(404)
  })
})
