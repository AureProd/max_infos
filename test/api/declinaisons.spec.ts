import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, article } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer } from '../setup/db'

let sqlClient: postgres.Sql
let db: BaseDeTest
let cookie = ''

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
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
    // Seule voie possible : lire ses propres publications LinkedIn est
    // impossible, le scope r_member_social est fermé aux nouvelles apps.
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
    // Pas d'identifiant externe : il ne vient que de l'API.
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
    const avant = await $fetch('/api/admin/social-posts', { headers: auth() })
    await $fetch('/api/admin/social-posts', {
      method: 'POST',
      headers: auth(),
      body: { network: 'linkedin', url: 'https://www.linkedin.com/posts/autre' },
    })
    const apres = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(apres.length).toBe(avant.length + 1)
  })
})

describe('rattachement', () => {
  it('dit dans la LISTE à quel article chaque publication est rattachée', async () => {
    // Sans cela, l'écran devait interroger chaque article un par un pour
    // reconstituer la table — une requête par article, pour une information
    // que la liste peut porter.
    const liste = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = liste[0]?.id as number
    await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: 'un-article' },
    })

    const apres = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(apres.find((p) => p.id === id)?.articleSlug).toBe('un-article')
    expect(apres.find((p) => p.id !== id)?.articleSlug).toBeNull()
  })

  it('rattache puis détache une publication', async () => {
    const liste = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = liste[0]?.id as number

    const lie = await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: 'un-article' },
    })
    expect(lie.lie).toBe('un-article')

    const a = await $fetch('/api/articles/un-article')
    expect(a.declinaisons.map((d) => d.id)).toContain(id)

    const delie = await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: { articleSlug: null },
    })
    expect(delie.lie).toBeNull()
  })

  it('refuse de rattacher à un article inexistant', async () => {
    const liste = await $fetch('/api/admin/social-posts', { headers: auth() })
    const r = await fetch(`/api/admin/social-posts/${liste[0]?.id}/article`, {
      method: 'PUT',
      headers: auth(),
      body: JSON.stringify({ articleSlug: 'jamais-vu' }),
    })
    expect(r.status).toBe(404)
  })
})

describe('visibilité', () => {
  it('masque une publication, qui disparaît du public', async () => {
    const liste = await $fetch('/api/admin/social-posts', { headers: auth() })
    const id = liste[0]?.id as number

    await $fetch(`/api/admin/social-posts/${id}/visibility`, {
      method: 'PUT',
      headers: auth(),
      body: { hidden: true },
    })

    const publiques = await $fetch('/api/social-posts')
    expect(publiques.map((p) => p.id)).not.toContain(id)

    // Mais elle reste visible dans l'admin : masquer n'est pas supprimer.
    const admin = await $fetch('/api/admin/social-posts', { headers: auth() })
    expect(admin.map((p) => p.id)).toContain(id)
  })
})

describe('gabarits de déclinaison', () => {
  it('résout les variables depuis l’article', async () => {
    const d = await $fetch('/api/admin/articles/un-article/declinaisons', { headers: auth() })
    expect(d.linkedin).toContain('Un article')
    expect(d.linkedin).toContain('Son chapô.')
    expect(d.linkedin).toContain('/article/un-article')
    expect(d.linkedin).toContain('7 min')
    // Aucune accolade ne doit subsister : Max copie le texte tel quel.
    expect(d.linkedin).not.toMatch(/\{\{/)
    expect(d.reel).not.toMatch(/\{\{/)
  })

  it('annonce les variables disponibles', async () => {
    const d = await $fetch('/api/admin/articles/un-article/declinaisons', { headers: auth() })
    expect(d.variables).toContain('titre')
    expect(d.variables).toContain('url')
  })
})
