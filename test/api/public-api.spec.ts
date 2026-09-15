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
  it('ne renvoie que les articles publiés', async () => {
    const r = await $fetch('/api/articles')
    expect(r.total).toBe(2)
    // The draft must appear nowhere: it is not « forbidden », it does not
    // exist for the public.
    expect(r.items.map((i) => i.slug)).not.toContain('article-brouillon')
  })

  it('trie du plus récent au plus ancien', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items.map((i) => i.slug)).toEqual(['article-publie', 'article-ancien'])
  })

  it('rend la date en jour seul, sans heure ni fuseau', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items[0]?.publishedAt).toBe('2026-09-10')
  })

  it('joint la cover et les sujets', async () => {
    const r = await $fetch('/api/articles')
    expect(r.items[0]?.coverUrl).toContain('cover.png')
    expect(r.items[0]?.tags).toEqual([{ slug: 'geo', label: 'Géographie' }])
  })

  it('filtre par tag sans fausser le total', async () => {
    const r = await $fetch('/api/articles', { query: { tag: 'geo' } })
    expect(r.total).toBe(1)
    expect(r.items[0]?.slug).toBe('article-publie')
  })

  it('cherche dans le corps, pas seulement dans le titre', async () => {
    const r = await $fetch('/api/articles', { query: { q: 'zzyzx' } })
    expect(r.items.map((i) => i.slug)).toEqual(['article-publie'])
  })

  it('pagine', async () => {
    const p1 = await $fetch('/api/articles', { query: { size: 1, page: 1 } })
    const p2 = await $fetch('/api/articles', { query: { size: 1, page: 2 } })
    expect(p1.items).toHaveLength(1)
    expect(p2.items).toHaveLength(1)
    expect(p1.items[0]?.slug).not.toBe(p2.items[0]?.slug)
    // The total describes the whole set, not the page.
    expect(p1.total).toBe(2)
  })

  it('refuse une requête hors bornes avec 400, pas 500', async () => {
    for (const q of ['?size=500', '?page=0', '?q=']) {
      expect((await fetch(`/api/articles${q}`)).status).toBe(400)
    }
  })
})

describe('GET /api/articles/[slug]', () => {
  it('renvoie l’article, ses sujets et ses déclinaisons', async () => {
    const a = await $fetch('/api/articles/article-publie')
    expect(a.title).toBe('Un article publié')
    expect(a.tags.map((t) => t.slug)).toEqual(['geo'])
    expect(a.variants.map((d) => d.shortcode)).toEqual(['ABC123'])
  })

  it('répond 404 sur un brouillon, et non 403', async () => {
    // A 403 would confirm the draft's existence.
    expect((await fetch('/api/articles/article-brouillon')).status).toBe(404)
  })

  it('répond 404 sur un article inconnu', async () => {
    expect((await fetch('/api/articles/jamais-vu')).status).toBe(404)
  })

  it('répond 400 sur un slug malformé, et non 500', async () => {
    for (const s of ['Majuscule', '..%2Fetc%2Fpasswd', 'deux--tirets']) {
      expect((await fetch(`/api/articles/${s}`)).status).toBe(400)
    }
  })
})

describe('GET /api/tags', () => {
  it('compte les articles publiés et trie à la française', async () => {
    const tags = await $fetch('/api/tags')
    // « Alpha » before « Géographie »: that is the localeCompare sort, run
    // in JavaScript so as not to depend on the PostgreSQL image's locales.
    expect(tags.map((t) => t.label)).toEqual(['Alpha', 'Géographie'])
    expect(tags.every((t) => t.n === 1)).toBe(true)
  })
})

describe('GET /api/social-posts', () => {
  it('masque les publications cachées', async () => {
    const posts = await $fetch('/api/social-posts')
    // MASQ1 is there: it belongs to a hidden account, which removes it from
    // the HOME PAGE, not from the general list. The two notions are
    // distinct.
    expect(posts.map((p) => p.shortcode)).toEqual(['ABC123', 'DEF456', 'MASQ1'])
  })

  it('n’expose JAMAIS la charge brute de Meta', async () => {
    const raw = await (await fetch('/api/social-posts')).text()
    expect(raw).not.toContain('raw')
    expect(raw).not.toContain('secret_meta')
  })

  it('filtre par article', async () => {
    const posts = await $fetch('/api/social-posts', { query: { article: 'article-publie' } })
    expect(posts).toHaveLength(1)
    expect(
      (await $fetch('/api/social-posts', { query: { article: 'article-ancien' } })).length,
    ).toBe(0)
  })

  it('refuse un réseau inconnu', async () => {
    expect((await fetch('/api/social-posts?network=mastodon')).status).toBe(400)
  })
})

describe('GET /api/social-accounts', () => {
  it('ne renvoie que les comptes affichés sur l’accueil', async () => {
    const accounts = await $fetch('/api/social-accounts')
    expect(accounts.map((c) => c.username)).toEqual(['maxinfo'])
  })

  it('reprend l’identité du compte, telle qu’Instagram la donne', async () => {
    // That is the design decision: the section's label and picture come
    // from the connected account, they are not typed in.
    const [account] = await $fetch('/api/social-accounts')
    expect(account?.displayName).toBe('Un Max d’info')
    expect(account?.avatarUrl).toBe('https://exemple.test/avatar.png')
    expect(account?.url).toBe('https://www.instagram.com/maxinfo')
    expect(account?.followers).toBe(120)
  })

  it('tronque au nombre de publications choisi, les plus récentes d’abord', async () => {
    const [account] = await $fetch('/api/social-accounts')
    // postsOnHome is 1 in the test data: DEF456, being older, stays out.
    expect(account?.publications.map((p) => p.shortcode)).toEqual(['ABC123'])
  })

  it('ne montre ni publication masquée ni publication d’un compte masqué', async () => {
    const raw = await (await fetch('/api/social-accounts')).text()
    expect(raw).not.toContain('CACHE1')
    expect(raw).not.toContain('MASQ1')
    expect(raw).not.toContain('archives')
  })

  it('n’expose ni la charge brute de Meta ni le moindre jeton', async () => {
    const raw = await (await fetch('/api/social-accounts')).text()
    expect(raw).not.toContain('secret_meta')
    expect(raw).not.toContain('ciphertext')
    expect(raw).not.toContain('access_token')
  })
})

describe('GET /api/site', () => {
  it('renvoie les réglages publics', async () => {
    const site = await $fetch<Record<string, { name?: string }>>('/api/site')
    expect(site.identity?.name).toBe('Site de test')
  })

  it('renvoie une valeur par défaut pour un réglage jamais enregistré', async () => {
    // A site whose CV is not filled in must render, not fail.
    const site = await $fetch<Record<string, unknown>>('/api/site')
    expect(site.cv).toBeDefined()
    expect(site.theme).toBeDefined()
  })

  it('ne laisse JAMAIS fuiter un réglage technique', async () => {
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
  it('incrémente sans lire avant d’écrire', async () => {
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

  it('répond 404 sur un article inconnu', async () => {
    expect((await fetch('/api/articles/jamais-vu/view', { method: 'POST' })).status).toBe(404)
  })
})
