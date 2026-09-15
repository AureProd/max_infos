import { fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer, semerJeuDeTest } from '../setup/db'

/**
 * Les écrans du back-office s'affichent-ils vraiment ?
 *
 * Une page qui compile n'est pas une page qui s'affiche : un composable mal
 * appelé, un réglage absent ou un type de réponse inattendu la fait tomber
 * en 500, et rien avant ce test ne le montrerait.
 */
let sqlClient: postgres.Sql
let db: BaseDeTest
const cookies: Record<'editor' | 'tech', string> = { editor: '', tech: '' }

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
  await semerJeuDeTest(db)
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
  const comptes = await db.select({ id: appUser.id, role: appUser.role }).from(appUser)
  for (const c of comptes) {
    if (c.role !== 'editor' && c.role !== 'tech') continue
    const r = await fetch('/api/test/session', {
      method: 'POST',
      body: JSON.stringify({ id: c.id }),
      headers: { 'content-type': 'application/json' },
    })
    cookies[c.role] = r.headers.get('set-cookie') ?? ''
  }
})

const ECRANS_EDITEUR = [
  '/admin',
  '/admin/articles',
  '/admin/publications',
  '/admin/home',
  '/admin/about',
  '/admin/appearance',
]

describe('accès', () => {
  it.each([...ECRANS_EDITEUR, '/admin/tech'])(
    '%s redirige vers la connexion sans session',
    async (chemin) => {
      const r = await fetch(chemin, { redirect: 'manual' })
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toContain('/login')
    },
  )
})

describe('affichage pour un editor', () => {
  it.each(ECRANS_EDITEUR)('%s s’affiche', async (chemin) => {
    const r = await fetch(chemin, { headers: { cookie: cookies.editor } })
    expect(r.status).toBe(200)
    const html = await r.text()
    // Une page Nuxt en erreur renvoie 200 avec sa page d'erreur : on
    // vérifie donc le CONTENU, pas seulement le code.
    expect(html).not.toContain('statusCode:500')
    expect(html).toContain('admin-page')
  })

  it('le menu ne propose PAS l’écran technique', async () => {
    // Masquage de confort : la sécurité reste le refus du serveur, vérifié
    // par test/api/authorization.spec.ts.
    const html = await (await fetch('/admin', { headers: { cookie: cookies.editor } })).text()
    expect(html).not.toContain('/admin/tech')
  })
})

describe('affichage pour un tech', () => {
  it('l’écran technique s’affiche', async () => {
    const r = await fetch('/admin/tech', { headers: { cookie: cookies.tech } })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('admin-page')
  })

  it('le menu propose l’écran technique', async () => {
    const html = await (await fetch('/admin', { headers: { cookie: cookies.tech } })).text()
    expect(html).toContain('/admin/tech')
  })
})

describe('éditeur d’article', () => {
  it('s’affiche sur un article existant', async () => {
    const r = await fetch('/admin/article-publie', { headers: { cookie: cookies.editor } })
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Un article publié')
  })
})
