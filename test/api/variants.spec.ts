import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, article } from '../../server/database/schema'
import { base, connection, migrate, type TestDatabase } from '../setup/db'

let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = base(sqlClient)
  await db.insert(appUser).values({ email: 'max@exemple.test', role: 'editor' })
  await db.insert(article).values({
    slug: 'un-article',
    title: 'Un article',
    dek: 'Son chapô.',
    status: 'published',
    publishedAt: new Date('2026-09-10T12:00:00Z'),
    readingMinutes: 7,
    charCount: 10013,
  })
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

describe('saisie manuelle', () => {
  it('enregistre une publication LinkedIn', async () => {
    // Seule voie possible : read ses propres publications LinkedIn est
    // impossible, le scope r_member_social est fermé aux fresh apps.
    const p = await $fetch('/api/admin/social-posts', {
      method: 'POST',
      headers: auth(),
      body: {
        network: 'linkedin',
        url: 'https://www.linkedin.com/posts/maximilien_abc',
        caption: 'Version condensée.',
      },
    })
    expect(p?.network).toBe('linkedin')
    expect(p?.source).toBe('manual')
    // Pas d'identifiant external : il ne vient que de l'API.
    expect(p?.externalId).toBeNull()
  })

  it('extrait le code court d’une adresse Instagram', async () => {
    const p = await $fetch('/api/admin/social-posts', {
      method: 'POST',
      headers: auth(),
      body: { network: 'instagram', url: 'https://www.instagram.com/reel/DdGUF5XJbhE/' },
    })
    expect(p?.shortcode).toBe('DdGUF5XJbhE')
  })

  it('laisse coexister PLUSIEURS saisies manuelles', async () => {
    // Les NULL étant distincts sous PostgreSQL, l'index unique
    // (network, external_id) ne les bloque pas. Comportement voulu.
    const before = await $fetch('/api/admin/social-posts', { headers: auth() })
    await $fetch('/api/admin/social-posts', {
      method: 'POST',
      headers: auth(),
      body: { network: 'linkedin', url: 'https://www.linkedin.com/posts/autre' },
    })
    const after = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(after.length).toBe(before.length + 1)
  })
})

describe('rattachement', () => {
  it('dit dans la LISTE à quel article chaque publication est rattachée', async () => {
    // Sans cela, l'écran devait interroger chaque article un par un pour
    // reconstituer la table — une requête par article, pour une information
    // que la list peut porter.
    const list = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = list[0]?.id as number
    await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: 'un-article' },
    })

    const after = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(after.find((p) => p.id === id)?.articleSlug).toBe('un-article')
    expect(after.find((p) => p.id !== id)?.articleSlug).toBeNull()
  })

  it('rattache puis détache une publication', async () => {
    const list = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = list[0]?.id as number

    const linked = await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: 'un-article' },
    })
    expect(linked.linked).toBe('un-article')

    const a = await $fetch('/api/articles/un-article')
    expect(a.variants.map((d) => d.id)).toContain(id)

    const detached = await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: null },
    })
    expect(detached.linked).toBeNull()
  })

  it('refuse de rattacher à un article inexistant', async () => {
    const list = await $fetch('/api/admin/social-posts', { headers: auth() })
    const r = await fetch(`/api/admin/social-posts/${list[0]?.id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: JSON.stringify({ articleSlug: 'jamais-vu' }),
    })
    expect(r.status).toBe(404)
  })
})

describe('visibilité', () => {
  it('masque une publication, qui disparaît du public', async () => {
    const list = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = list[0]?.id as number

    await $fetch(`/api/admin/social-posts/${id}/visibility`, {
      method: 'PUT',
      headers: auth(),
      body: { hidden: true },
    })

    const publicOnes = await $fetch('/api/social-posts')
    expect(publicOnes.map((p) => p.id)).not.toContain(id)

    // Mais elle reste visible dans l'admin : masquer n'est pas remove.
    const admin = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(admin.map((p) => p.id)).toContain(id)
  })
})

describe('gabarits de déclinaison', () => {
  it('résout les variables depuis l’article', async () => {
    const d = await $fetch('/api/admin/articles/un-article/variants', { headers: auth() })
    expect(d.linkedin).toContain('Un article')
    expect(d.linkedin).toContain('Son chapô.')
    expect(d.linkedin).toContain('/article/un-article')
    expect(d.linkedin).toContain('7 min')
    // Aucune accolade ne doit subsister : Max copied le text tel quel.
    expect(d.linkedin).not.toMatch(/\{\{/)
    expect(d.reel).not.toMatch(/\{\{/)
  })

  it('annonce les variables disponibles', async () => {
    const d = await $fetch('/api/admin/articles/un-article/variants', { headers: auth() })
    expect(d.variables).toContain('titre')
    expect(d.variables).toContain('url')
  })
})
