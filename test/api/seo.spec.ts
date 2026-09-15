import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { article, setting } from '../../server/database/schema'
import { base, connection, migrate, type TestDatabase } from '../setup/db'

/**
 * Le référencement. C'est le pattern de la bascule vers Nuxt : ces tagNames
 * doivent être DANS LA RÉPONSE HTTP, sans exécution de JavaScript — les
 * robots de LinkedIn, WhatsApp et Slack n'en exécutent pas.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = base(sqlClient)
  await db.insert(setting).values({
    key: 'identity',
    value: {
      name: "Un Max d'info",
      author: 'Maximilien Huet',
      byline: 'Max',
      tagline: 'Comprendre ce que l’actualité n’explique pas.',
      pitch: 'Enquêtes au long cours.',
    },
    scope: 'public',
  })
  await db.insert(article).values({
    slug: 'article-seo',
    title: 'Un titre & une esperluette',
    dek: 'Le chapô de l’article.',
    bodyMd: '## Section\n\nDu texte.',
    bodyHtml: '<h2>Section</h2><p>Du texte.</p>',
    status: 'published',
    publishedAt: new Date('2026-09-10T12:00:00Z'),
    readingMinutes: 3,
    charCount: 1800,
  })
  await db.insert(article).values({
    slug: 'brouillon-seo',
    title: 'Brouillon',
    status: 'draft',
  })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

describe('balises de partage, dans la réponse HTTP', () => {
  it('l’article porte ses balises Open Graph', async () => {
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:type" content="article"')
  })

  it('le CORPS de l’article est dans la réponse, sans JavaScript', async () => {
    // C'est all l'enjeu : le module app/render/ du plan n'a jamais eu à
    // exister parce que Nuxt le fait nativement.
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('Du texte.')
    expect(html).toContain('<h2>Section</h2>')
  })

  it('le JSON-LD décrit l’article', async () => {
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('application/ld+json')
    expect(html).toContain('"@type":"Article"')
    expect(html).toContain('Maximilien Huet')
  })
})

describe('codes de réponse', () => {
  it('un article inexistant répond 404, pas 200', async () => {
    // useFetch range le 404 de l'API dans `error` et rend quand même la
    // page : sans propagation explicit, les robots indexeraient une page
    // vide comme valid.
    expect((await fetch('/article/jamais-existe')).status).toBe(404)
  })

  it('un BROUILLON répond 404 sur le site public', async () => {
    expect((await fetch('/article/brouillon-seo')).status).toBe(404)
  })

  it('un article publié répond bien 200', async () => {
    expect((await fetch('/article/article-seo')).status).toBe(200)
  })
})

describe('flux RSS', () => {
  it('est bien du XML, et se déclare comme tel', async () => {
    const r = await fetch('/rss.xml')
    expect(r.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await r.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
  })

  it('ÉCHAPPE les caractères qui casseraient le flux', async () => {
    // Un title contenant « & » produit du XML invalide sans échappement,
    // et le validateur du W3C le refuse.
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).toContain('Un titre &amp; une esperluette')
    expect(xml).not.toMatch(/<title>[^<]*[^&]& /)
  })

  it('ne contient AUCUN brouillon', async () => {
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).not.toContain('brouillon-seo')
  })

  it('porte un lien atom:self, exigé par le validateur', async () => {
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).toContain('rel="self"')
  })
})

describe('plan du site', () => {
  it('liste les articles publiés et pas les brouillons', async () => {
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).toContain('/article/article-seo')
    expect(xml).not.toContain('brouillon-seo')
  })

  it('n’indique PAS où se trouve le back-office', async () => {
    // Lister /admin reviendrait à indiquer où frapper.
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).not.toContain('/admin')
    expect(xml).not.toContain('/login')
  })
})

describe('robots.txt', () => {
  it('interdit tout hors production', async () => {
    // Une préproduction indexée fait doublon avec la production et lui nuit.
    const txt = await (await fetch('/robots.txt')).text()
    expect(txt).toContain('Disallow: /')
  })
})

describe('en-têtes', () => {
  it('le back-office porte x-robots-tag, même sans HTML lu', async () => {
    const r = await fetch('/login')
    expect(r.headers.get('x-robots-tag')).toContain('noindex')
  })
})
