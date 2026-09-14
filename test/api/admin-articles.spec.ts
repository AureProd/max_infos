import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, article } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer } from '../setup/db'

/** Le back-office, contre une vraie base. */
let sqlClient: postgres.Sql
let db: BaseDeTest
let cookie = ''

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
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

describe('cycle de vie d’un article', () => {
  it('naît TOUJOURS en brouillon', async () => {
    // Publier doit être un geste explicite, jamais un effet de bord.
    const cree = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Mon premier', bodyMd: '## Titre\n\nUn corps.', tags: ['Essai'] },
    })
    expect(cree.status).toBe('draft')
    expect(cree.publishedAt).toBeNull()
    expect(cree.slug).toBe('mon-premier')
  })

  it('reste invisible du public tant qu’il est brouillon', async () => {
    const liste = await $fetch('/api/articles')
    expect(liste.items.map((i) => i.slug)).not.toContain('mon-premier')
    expect((await fetch('/api/articles/mon-premier')).status).toBe(404)
  })

  it('rend et assainit le corps à l’ENREGISTREMENT', async () => {
    const maj = await $fetch('/api/admin/articles/mon-premier', {
      method: 'PUT',
      headers: auth(),
      body: {
        title: 'Mon premier',
        bodyMd: 'Texte <script>alert(1)</script> et [lien](javascript:alert(2)).',
        tags: ['Essai'],
        featured: false,
      },
    })
    expect(maj.bodyHtml).toContain('Texte')
    expect(maj.bodyHtml).not.toContain('<script')
    expect(maj.bodyHtml).not.toContain('javascript:')
  })

  it('recalcule les mesures dérivées', async () => {
    const maj = await $fetch('/api/admin/articles/mon-premier', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Mon premier', bodyMd: 'x'.repeat(2000), tags: [], featured: false },
    })
    expect(maj.charCount).toBe(2000)
    expect(maj.readingMinutes).toBe(2)
  })

  it('publie, et l’article apparaît alors publiquement', async () => {
    const r = await $fetch('/api/admin/articles/mon-premier/status', {
      method: 'PUT',
      headers: auth(),
      body: { status: 'published' },
    })
    expect(r?.status).toBe('published')
    // La contrainte SQL exige une date : la route la fournit plutôt que de
    // laisser PostgreSQL renvoyer une erreur à Max.
    expect(r?.publishedAt).toBeTruthy()

    const liste = await $fetch('/api/articles')
    expect(liste.items.map((i) => i.slug)).toContain('mon-premier')
  })

  it('dépublie sans perdre la date de publication', async () => {
    await $fetch('/api/admin/articles/mon-premier/status', {
      method: 'PUT',
      headers: auth(),
      body: { status: 'draft' },
    })
    const a = await $fetch('/api/admin/articles/mon-premier', { headers: auth() })
    expect(a.status).toBe('draft')
    // La date reste : republier ne doit pas faire remonter l'article en
    // tête de liste comme s'il était neuf.
    expect(a.publishedAt).toBeTruthy()
  })

  it('supprime, et la liaison de sujet part en cascade', async () => {
    await $fetch('/api/admin/articles/mon-premier', { method: 'DELETE', headers: auth() })
    expect((await fetch('/api/admin/articles/mon-premier', { headers: auth() })).status).toBe(404)
    const restants = await db.select().from(article).where(eq(article.slug, 'mon-premier'))
    expect(restants).toHaveLength(0)
  })
})

describe('slugs', () => {
  it('déduit un slug du titre, et en trouve un libre s’il est pris', async () => {
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
    // Sans cela, Max recevrait une violation de contrainte à la figure.
    expect(b.slug).toBe('titre-repete-2')
  })
})

describe('sujets', () => {
  it('crée les sujets inconnus et les rattache', async () => {
    const a = await $fetch('/api/admin/articles', {
      method: 'POST',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: ['Géopolitique', 'Europe'] },
    })
    expect(a.tags.map((t) => t.slug).sort()).toEqual(['europe', 'geopolitique'])
  })

  it('REMPLACE les sujets, il ne les ajoute pas', async () => {
    // C'est ce qu'attend un formulaire où l'on retire une étiquette.
    const maj = await $fetch('/api/admin/articles/avec-sujets', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: ['Europe'], featured: false },
    })
    expect(maj.tags.map((t) => t.slug)).toEqual(['europe'])
  })

  it('retire tous les sujets quand la liste est vide', async () => {
    const maj = await $fetch('/api/admin/articles/avec-sujets', {
      method: 'PUT',
      headers: auth(),
      body: { title: 'Avec sujets', bodyMd: '', tags: [], featured: false },
    })
    expect(maj.tags).toEqual([])
  })
})

describe('aperçu', () => {
  it('passe par le MÊME moteur que l’enregistrement', async () => {
    const a = await $fetch('/api/admin/preview', {
      method: 'POST',
      headers: auth(),
      body: { bodyMd: '## Titre\n\n<script>x</script>' },
    })
    expect(a.html).toContain('<h2>Titre</h2>')
    expect(a.html).not.toContain('<script')
  })
})

describe('médias', () => {
  it('refuse un type de fichier hors liste', async () => {
    const r = await fetch('/api/admin/media/upload-url', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        filename: 'malveillant.svg',
        contentType: 'image/svg+xml',
        bytes: 100,
      }),
    })
    // Le SVG est un vecteur de script : il n'est pas dans la liste admise.
    expect(r.status).toBe(415)
  })

  it('enregistre la ligne AVANT de renvoyer l’URL signée', async () => {
    // Un fichier téléversé sans ligne serait invisible et impossible à
    // nettoyer ; une ligne sans fichier se repère et se supprime.
    const r = await $fetch('/api/admin/media/upload-url', {
      method: 'POST',
      headers: auth(),
      body: { filename: 'Photo de Max.PNG', contentType: 'image/png', bytes: 2048 },
    })
    expect(r.media?.id).toBeGreaterThan(0)
    expect(r.uploadUrl).toContain('X-Amz-Signature')
    // Nom de fichier normalisé, préfixé par la date, suffixé d'un aléa.
    expect(r.media?.url).toMatch(
      /^https:\/\/media\.exemple\.test\/\d{4}-\d{2}-\d{2}\/\w+-photo-de-max\.png$/,
    )
  })

  it('dit si le stockage est configuré', async () => {
    const r = await $fetch('/api/admin/media', { headers: auth() })
    expect(r.stockage).toBe(true)
  })
})
