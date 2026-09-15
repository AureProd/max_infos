import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SETTING_SCOPE, type SettingKey } from '#shared/schemas/settings'
import { base, connection, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * L'API publique, contre une VRAIE base.
 *
 * Le pattern « une transaction annulée par test » ne vaut pas here : le
 * handler Nitro ouvre ses propres connexions et ne verrait rien de ce
 * qu'une transaction de test aurait écrit. On sème donc une fois, before le
 * démarrage du serveur, et les tests ne font que read — sauf le compteur de
 * views, qui vérifie justement une écriture.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = base(sqlClient)
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
    // Le draft ne doit apparaître nulle part : il n'est pas « interdit »,
    // il n'existe pas pour le public.
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
    // Le total décrit l'ensemble, pas la page.
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
    // Un 403 confirmerait l'existence du draft.
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
    // « Alpha » before « Géographie » : c'est le tri localeCompare, fait en
    // JavaScript pour ne pas dépendre des locales de l'image PostgreSQL.
    expect(tags.map((t) => t.label)).toEqual(['Alpha', 'Géographie'])
    expect(tags.every((t) => t.n === 1)).toBe(true)
  })
})

describe('GET /api/social-posts', () => {
  it('masque les publications cachées', async () => {
    const posts = await $fetch('/api/social-posts')
    // MASQ1 est là : elle appartient à un account masqué, ce qui la retire de
    // l'ACCUEIL, pas de la list générale. Les two notions sont distinctes.
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
    // C'est la décision de conception : le libellé et la photo de la section
    // viennent du account connecté, ils ne se saisissent pas.
    const [account] = await $fetch('/api/social-accounts')
    expect(account?.displayName).toBe('Un Max d’info')
    expect(account?.avatarUrl).toBe('https://exemple.test/avatar.png')
    expect(account?.url).toBe('https://www.instagram.com/maxinfo')
    expect(account?.followers).toBe(120)
  })

  it('tronque au nombre de publications choisi, les plus récentes d’abord', async () => {
    const [account] = await $fetch('/api/social-accounts')
    // postsOnHome vaut 1 dans le jeu de test : DEF456, plus ancienne, reste
    // dehors.
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
    // Un site dont le CV n'est pas rempli doit s'afficher, pas échouer.
    const site = await $fetch<Record<string, unknown>>('/api/site')
    expect(site.cv).toBeDefined()
    expect(site.theme).toBeDefined()
  })

  it('ne laisse JAMAIS fuiter un réglage technique', async () => {
    // Le pire risque du projet selon le plan : que Max — ou n'importe qui —
    // voie ce qui relève de l'infrastructure.
    //
    // On ÉNUMÈRE SETTING_SCOPE plutôt que de chercher une sous-chaîne : la
    // version précédente cherchait « instagram », qui apparaît légitimement
    // dans la clé PUBLIQUE instagram_public. Un test qui se trompe de target
    // finit par être désactivé plutôt que corrigé.
    const site = await $fetch<Record<string, unknown>>('/api/site')
    const technical = (Object.keys(SETTING_SCOPE) as SettingKey[]).filter(
      (c) => SETTING_SCOPE[c] === 'tech',
    )
    expect(technical.length).toBeGreaterThan(0)
    for (const key of technical) {
      expect(Object.keys(site), `${key} ne doit pas être public`).not.toContain(key)
    }
    // Et la value elle-même n'apparaît nulle part dans la réponse.
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
