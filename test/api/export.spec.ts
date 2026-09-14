import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, secret } from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer, semerJeuDeTest } from '../setup/db'

/**
 * L'aller-retour prévu au plan : exporter, vider, réimporter, comparer
 * terme à terme.
 *
 * C'est le seul test qui prouve qu'on peut déménager le site ou repartir
 * d'une base vierge. Le reste n'est que de la confiance.
 */
let sqlClient: postgres.Sql
let db: BaseDeTest
let cookie = ''

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
  await semerJeuDeTest(db)
  await db.insert(appUser).values({ email: 'jb@exemple.test', role: 'tech' })
  // Un jeton chiffré, pour vérifier qu'il ne sort JAMAIS.
  await db.insert(secret).values({
    key: 'instagram_access_token',
    ciphertext: 'v1.aaa.bbb.jeton-chiffre-a-ne-jamais-exporter', // pragma: allowlist secret
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

describe('export', () => {
  it('porte une version de schéma et des comptages', async () => {
    const a = await $fetch('/api/admin/export', { headers: auth() })
    expect(a.manifest.version).toBe(1)
    expect(a.manifest.comptages.articles).toBeGreaterThan(0)
  })

  it('se propose en téléchargement, daté', async () => {
    const r = await fetch('/api/admin/export', { headers: auth() })
    expect(r.headers.get('content-disposition')).toMatch(
      /attachment; filename="export-\d{4}-\d{2}-\d{2}\.json"/,
    )
  })

  it('n’exporte JAMAIS les jetons tiers', async () => {
    // Les réexporter reviendrait à sortir des identifiants d'accès d'un
    // système pour les poser dans un fichier qu'on va télécharger.
    const brut = await (await fetch('/api/admin/export', { headers: auth() })).text()
    expect(brut).not.toContain('jeton-chiffre-a-ne-jamais-exporter')
    expect(brut).not.toContain('ciphertext')
  })

  it('n’exporte d’un compte que son adresse et son rôle', async () => {
    const a = await $fetch('/api/admin/export', { headers: auth() })
    const compte = (a.users as Record<string, unknown>[])[0]
    expect(Object.keys(compte ?? {}).sort()).toEqual(['active', 'email', 'name', 'role'])
  })
})

describe('simulation d’import', () => {
  it('n’écrit RIEN et montre le différentiel', async () => {
    const avantTest = await $fetch('/api/admin/export', { headers: auth() })

    const r = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: {
        archive: { manifest: { version: 1, comptages: { articles: 99 } } },
        vider: true,
        simulation: true,
      },
    })
    expect(r.simulation).toBe(true)
    expect(r.apres).toEqual({ articles: 99 })

    const apresTest = await $fetch('/api/admin/export', { headers: auth() })
    expect(apresTest.manifest.comptages).toEqual(avantTest.manifest.comptages)
  })

  it('refuse une archive d’une AUTRE version de schéma', async () => {
    // Écrire n'importe quoi serait pire que refuser.
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ archive: { manifest: { version: 99 } }, simulation: false }),
    })
    expect(r.status).toBe(422)
  })
})

describe('aller-retour complet', () => {
  it('exporter, vider, réimporter : les données sont identiques', async () => {
    const avant = await $fetch('/api/admin/export', { headers: auth() })

    const ecrits = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: { archive: avant, vider: true, simulation: false },
    })
    expect(ecrits.simulation).toBe(false)

    const apres = await $fetch('/api/admin/export', { headers: auth() })

    // Terme à terme, et non « à peu près » : un import qui perd une
    // liaison ou un réglage ne se verrait pas autrement.
    expect(apres.manifest.comptages).toEqual(avant.manifest.comptages)
    for (const cle of [
      'articles',
      'tags',
      'liaisonsTags',
      'media',
      'socialPosts',
      'liaisonsSocial',
      'settings',
      'users',
      'views',
    ] as const) {
      expect(apres[cle], `${cle} doit être identique après l'aller-retour`).toEqual(avant[cle])
    }
  })

  it('le jeton chiffré a SURVÉCU au vidage', async () => {
    // `secret` est volontairement absente du truncate : un import ne doit
    // pas effacer les accès aux comptes tiers.
    const [restant] = await db.select().from(secret)
    expect(restant?.ciphertext).toContain('jeton-chiffre-a-ne-jamais-exporter')
  })

  it('le site public répond toujours après l’aller-retour', async () => {
    const liste = await $fetch('/api/articles')
    expect(liste.total).toBeGreaterThan(0)
  })
})
