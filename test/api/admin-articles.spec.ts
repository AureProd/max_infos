import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, article } from '../../server/database/schema'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/** The back-office, against a real database. */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await db.insert(appUser).values({ email: 'max@exemple.test', role: 'editor' })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

beforeAll(async () => {
  const [u] = await db.select({ id: appUser.id }).from(appUser).limit(1)
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: u?.id }),
    headers: { 'content-type': 'application/json' },
  })
  cookie = r.headers.get('set-cookie') ?? ''
})

const auth = () => ({ cookie, 'content-type': 'application/json' })

describe('article life cycle', () => {
  it('is ALWAYS born a draft', async () => {
    // Publishing must be an explicit act, never a side effect.
    const created = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Mon premier', bodyMd: '## Titre\n\nUn corps.', tags: ['Essai'] },
    })
    expect(created.status).toBe('draft')
    expect(created.publishedAt).toBeNull()
    expect(created.slug).toBe('mon-premier')
  })

  it('stays invisible to the public while it is a draft', async () => {
    const list = await $fetch('/api/articles')
    expect(list.items.map((i) => i.slug)).not.toContain('mon-premier')
    expect((await fetch('/api/articles/mon-premier')).status).toBe(404)
  })

  it('renders and sanitises the body ON SAVE', async () => {
    const update = await $fetch('/api/admin/articles/mon-premier', {
      method: 'PUT',
      headers: auth(),
      body: {
        title: 'Mon premier',
        bodyMd: 'Texte <script>alert(1)</script> et [lien](javascript:alert(2)).',
        tags: ['Essai'],
        featured: false,
      },
    })
    expect(update.bodyHtml).toContain('Texte')
    expect(update.bodyHtml).not.toContain('<script')
    expect(update.bodyHtml).not.toContain('javascript:')
  })

  it('recomputes the derived measurements', async () => {
    const update = await $fetch('/api/admin/articles/mon-premier', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Mon premier', bodyMd: 'x'.repeat(2000), tags: [], featured: false },
    })
    expect(update.charCount).toBe(2000)
    expect(update.readingMinutes).toBe(2)
  })

  it('publishes, and the article then appears publicly', async () => {
    const r = await $fetch('/api/admin/articles/mon-premier/status', {
      method: 'PUT',
      headers: auth(),
      body: { status: 'published' },
    })
    expect(r?.status).toBe('published')
    // The SQL constraint requires a date: the route supplies it rather than
    // letting PostgreSQL throw an error at Max.
    expect(r?.publishedAt).toBeTruthy()

    const list = await $fetch('/api/articles')
    expect(list.items.map((i) => i.slug)).toContain('mon-premier')
  })

  it('unpublishes without losing the publication date', async () => {
    await $fetch('/api/admin/articles/mon-premier/status', {
      method: 'PUT',
      headers: auth(),
      body: { status: 'draft' },
    })
    const a = await $fetch('/api/admin/articles/mon-premier', { headers: auth() })
    expect(a.status).toBe('draft')
    // The date stays: republishing must not push the article back to the
    // top of the list as if it were new.
    expect(a.publishedAt).toBeTruthy()
  })

  it('deletes, and the tag link goes on cascade', async () => {
    await $fetch('/api/admin/articles/mon-premier', { method: 'DELETE', headers: auth() })
    expect((await fetch('/api/admin/articles/mon-premier', { headers: auth() })).status).toBe(404)
    const remaining = await db.select().from(article).where(eq(article.slug, 'mon-premier'))
    expect(remaining).toHaveLength(0)
  })
})

describe('slugs', () => {
  it('derives a slug from the title, and finds a free one when taken', async () => {
    const a = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Titre répété', bodyMd: '', tags: [] },
    })
    const b = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Titre répété', bodyMd: '', tags: [] },
    })
    expect(a.slug).toBe('titre-repete')
    // Without this, Max would get a constraint violation in his face.
    expect(b.slug).toBe('titre-repete-2')
  })
})

describe('tags', () => {
  it('creates the unknown tags and attaches them', async () => {
    const a = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: ['Géopolitique', 'Europe'] },
    })
    expect(a.tags.map((t) => t.slug).sort()).toEqual(['europe', 'geopolitique'])
  })

  it('REPLACES the tags, it does not add to them', async () => {
    // That is what a form where you remove a tag expects.
    const update = await $fetch('/api/admin/articles/avec-sujets', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: ['Europe'], featured: false },
    })
    expect(update.tags.map((t) => t.slug)).toEqual(['europe'])
  })

  it('removes every tag when the list is empty', async () => {
    const update = await $fetch('/api/admin/articles/avec-sujets', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: [], featured: false },
    })
    expect(update.tags).toEqual([])
  })
})

describe('preview', () => {
  it('goes through the SAME engine as saving', async () => {
    const a = await $fetch('/api/admin/preview', {
      method: 'POST',
      headers: auth(),
      body: { bodyMd: '## Titre\n\n<script>x</script>' },
    })
    expect(a.html).toContain('<h2>Titre</h2>')
    expect(a.html).not.toContain('<script')
  })
})

describe('media', () => {
  it('refuses a file type outside the list', async () => {
    const r = await fetch('/api/admin/media/upload-url', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        filename: 'malveillant.svg',
        contentType: 'image/svg+xml',
        bytes: 100,
      }),
    })
    // SVG is a script vector: it is not on the allowed list.
    expect(r.status).toBe(415)
  })

  it('records the row BEFORE returning the signed URL', async () => {
    // A file uploaded without a row would be invisible and impossible to
    // clean up; a row without a file is easy to spot and delete.
    const r = await $fetch('/api/admin/media/upload-url', {
      method: 'POST',
      headers: auth(),
      body: { filename: 'Photo de Max.PNG', contentType: 'image/png', bytes: 2048 },
    })
    expect(r.media?.id).toBeGreaterThan(0)
    expect(r.uploadUrl).toContain('X-Amz-Signature')
    // Normalised file name, prefixed with the date, suffixed with a random.
    expect(r.media?.url).toMatch(
      /^https:\/\/media\.exemple\.test\/\d{4}-\d{2}-\d{2}\/\w+-photo-de-max\.png$/,
    )
  })

  it('says whether storage is configured', async () => {
    const r = await $fetch('/api/admin/media', { headers: auth() })
    expect(r.stockage).toBe(true)
  })
})
