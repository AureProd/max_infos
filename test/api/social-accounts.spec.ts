import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer, semerJeuDeTest } from '../setup/db'

/**
 * Les comptes sociaux vus du back-office.
 *
 * C'est l'écran Réseaux qui se joue ici : Max connecte, ordonne, masque,
 * déconnecte. Les tests portent sur ce qu'il constate — l'accueil change —
 * et non sur la forme des requêtes.
 */
let sqlClient: postgres.Sql
let db: BaseDeTest
let editeur = 0

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
  await semerJeuDeTest(db)
  const [e] = await db
    .insert(appUser)
    .values({ email: 'max@exemple.test', role: 'editor' })
    .returning({ id: appUser.id })
  editeur = e?.id ?? 0
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

async function cookieEditeur(): Promise<string> {
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: editeur }),
    headers: { 'content-type': 'application/json' },
  })
  return r.headers.get('set-cookie') ?? ''
}

describe('GET /api/admin/social-accounts', () => {
  it('montre AUSSI les comptes masqués — sinon on ne peut plus les réafficher', async () => {
    const comptes = await $fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    expect(comptes.map((c) => c.username)).toEqual(['maxinfo', 'archives'])
    expect(comptes.find((c) => c.username === 'archives')?.visible).toBe(false)
  })

  it('dit combien de publications chaque compte emporterait', async () => {
    // L'écran prévient avant de déconnecter : la suppression est définitive.
    const comptes = await $fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    expect(comptes.find((c) => c.username === 'maxinfo')?.nbPublications).toBe(3)
    expect(comptes.find((c) => c.username === 'archives')?.nbPublications).toBe(1)
  })

  it('signale qu’un compte n’a pas de jeton, sans jamais le montrer', async () => {
    const r = await fetch('/api/admin/social-accounts', {
      headers: { cookie: await cookieEditeur() },
    })
    const brut = await r.text()
    expect(brut).not.toContain('ciphertext')
    expect(JSON.parse(brut)[0].connecte).toBe(false)
  })
})

describe('PUT /api/admin/social-accounts/[id]', () => {
  it('change l’ordre des sections de l’accueil', async () => {
    const cookie = await cookieEditeur()
    const comptes = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const max = comptes.find((c) => c.username === 'maxinfo')
    const archives = comptes.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { visible: true, position: 0 },
    })
    await $fetch(`/api/admin/social-accounts/${max?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { position: 1 },
    })

    expect((await $fetch('/api/social-accounts')).map((c) => c.username)).toEqual([
      'archives',
      'maxinfo',
    ])
  })

  it('change le nombre de publications montrées', async () => {
    const cookie = await cookieEditeur()
    const comptes = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const max = comptes.find((c) => c.username === 'maxinfo')

    await $fetch(`/api/admin/social-accounts/${max?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { postsOnHome: 2 },
    })

    const section = (await $fetch('/api/social-accounts')).find((c) => c.username === 'maxinfo')
    expect(section?.publications.map((p) => p.shortcode)).toEqual(['ABC123', 'DEF456'])
  })

  it('retire la section de l’accueil quand Max la masque', async () => {
    const cookie = await cookieEditeur()
    const comptes = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const archives = comptes.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { visible: false },
    })

    expect((await $fetch('/api/social-accounts')).map((c) => c.username)).toEqual(['maxinfo'])
  })

  it('refuse un nombre de publications absurde', async () => {
    const r = await fetch('/api/admin/social-accounts/1', {
      method: 'PUT',
      headers: { cookie: await cookieEditeur(), 'content-type': 'application/json' },
      body: JSON.stringify({ postsOnHome: 0 }),
    })
    expect(r.status).toBe(400)
  })
})

describe('DELETE /api/admin/social-accounts/[id]', () => {
  it('emporte le compte, ses publications et son jeton', async () => {
    const cookie = await cookieEditeur()
    const comptes = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    const archives = comptes.find((c) => c.username === 'archives')

    await $fetch(`/api/admin/social-accounts/${archives?.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    const restants = await $fetch('/api/admin/social-accounts', { headers: { cookie } })
    expect(restants.map((c) => c.username)).toEqual(['maxinfo'])
    // MASQ1 appartenait au compte supprimé.
    expect((await $fetch('/api/social-posts')).map((p) => p.shortcode)).not.toContain('MASQ1')
  })

  it('répond 404 sur un compte inconnu, sans rien casser', async () => {
    const r = await fetch('/api/admin/social-accounts/999999', {
      method: 'DELETE',
      headers: { cookie: await cookieEditeur() },
    })
    expect(r.status).toBe(404)
  })
})
