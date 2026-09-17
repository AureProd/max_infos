import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { article, setting } from '../../server/database/schema'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * SEO. This is the point of the move to Nuxt: these tags must be IN THE
 * HTTP RESPONSE, without running JavaScript — the LinkedIn, WhatsApp and
 * Slack robots do not run any.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await db.insert(setting).values({
    key: 'identity',
    value: {
      name: "Un Max d'info",
      author: 'Maximilien Huet',

      tagline: 'Comprendre ce que l’actualité n’explique pas.',
      pitch: 'Enquêtes au long cours.',
    },
    scope: 'public',
  })
  await db.insert(article).values({
    slug: 'article-seo',
    title: 'Un titre & une esperluette',
    dek: 'Le chapô de l’article.',
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

describe('sharing tags, in the HTTP response', () => {
  it('the article carries its Open Graph tags', async () => {
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:type" content="article"')
  })

  it('the article BODY is in the response, without JavaScript', async () => {
    // That is the whole point: the plan's app/render/ module never had to
    // exist because Nuxt does it natively.
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('Du texte.')
    expect(html).toContain('<h2>Section</h2>')
  })

  it('the JSON-LD describes the article', async () => {
    const html = await $fetch<string>('/article/article-seo')
    expect(html).toContain('application/ld+json')
    expect(html).toContain('"@type":"Article"')
    expect(html).toContain('Maximilien Huet')
  })
})

describe('response codes', () => {
  it('a non-existent article answers 404, not 200', async () => {
    // useFetch files the API's 404 under `error` and renders the page
    // anyway: without explicit propagation, robots would index an empty
    // page as valid.
    expect((await fetch('/article/jamais-existe')).status).toBe(404)
  })

  it('a DRAFT answers 404 on the public site', async () => {
    expect((await fetch('/article/brouillon-seo')).status).toBe(404)
  })

  it('a published article does answer 200', async () => {
    expect((await fetch('/article/article-seo')).status).toBe(200)
  })
})

describe('RSS feed', () => {
  it('is XML indeed, and declares itself as such', async () => {
    const r = await fetch('/rss.xml')
    expect(r.headers.get('content-type')).toContain('application/rss+xml')
    const xml = await r.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
  })

  it('ESCAPES the characters that would break the feed', async () => {
    // A title containing « & » produces invalid XML without escaping, and
    // the W3C validator refuses it.
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).toContain('Un titre &amp; une esperluette')
    expect(xml).not.toMatch(/<title>[^<]*[^&]& /)
  })

  it('contains NO draft', async () => {
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).not.toContain('brouillon-seo')
  })

  it('carries an atom:self link, required by the validator', async () => {
    const xml = await (await fetch('/rss.xml')).text()
    expect(xml).toContain('rel="self"')
  })
})

describe('sitemap', () => {
  it('lists the published articles and not the drafts', async () => {
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).toContain('/article/article-seo')
    expect(xml).not.toContain('brouillon-seo')
  })

  it('does NOT point at where the back-office is', async () => {
    // Listing /admin would amount to pointing at where to knock.
    const xml = await (await fetch('/sitemap.xml')).text()
    expect(xml).not.toContain('/admin')
    expect(xml).not.toContain('/login')
  })
})

describe('robots.txt', () => {
  it('disallows everything outside production', async () => {
    // An indexed staging environment duplicates production and hurts it.
    const txt = await (await fetch('/robots.txt')).text()
    expect(txt).toContain('Disallow: /')
  })
})

describe('headers', () => {
  it('the back-office carries x-robots-tag, even with no HTML read', async () => {
    const r = await fetch('/login')
    expect(r.headers.get('x-robots-tag')).toContain('noindex')
  })
})
