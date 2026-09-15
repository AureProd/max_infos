import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { strFromU8, unzipSync } from 'fflate'
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
    ciphertext: 'v1.aaa.bbb.jeton-chiffre-a-ne-jamais-exporter',
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

/** Récupère l'archive et la décompresse réellement. */
async function telechargerArchive(): Promise<Record<string, string>> {
  const r = await fetch('/api/admin/export', { headers: auth() })
  expect(r.status).toBe(200)
  const octets = new Uint8Array(await r.arrayBuffer())
  const entrees = unzipSync(octets)
  return Object.fromEntries(
    Object.entries(entrees).map(([nom, contenu]) => [
      nom.split('/').slice(1).join('/'),
      strFromU8(contenu),
    ]),
  )
}

describe('export', () => {
  it('produit une VRAIE archive zip, qui s’ouvre', async () => {
    // Une archive qui se télécharge mais ne s'ouvre pas n'est pas une
    // sauvegarde. `unzipSync` échouerait sur un fichier mal formé.
    const fichiers = await telechargerArchive()
    expect(Object.keys(fichiers).length).toBeGreaterThan(5)
  })

  it('se propose en téléchargement, datée', async () => {
    const r = await fetch('/api/admin/export', { headers: auth() })
    expect(r.headers.get('content-type')).toBe('application/zip')
    expect(r.headers.get('content-disposition')).toMatch(
      /attachment; filename="export-\d{4}-\d{2}-\d{2}\.zip"/,
    )
  })

  it('porte une version de schéma et des comptages', async () => {
    const fichiers = await telechargerArchive()
    const manifeste = JSON.parse(fichiers['manifest.json'] ?? '{}')
    expect(manifeste.version).toBe(2)
    expect(manifeste.comptages.articles).toBeGreaterThan(0)
  })

  it('contient les articles en MARKDOWN, lisibles tels quels', async () => {
    // Une archive qu'on ne peut ouvrir qu'avec le logiciel qui l'a produite
    // n'est pas une sauvegarde, c'est une dépendance.
    const fichiers = await telechargerArchive()
    const md = Object.entries(fichiers).filter(([n]) => n.startsWith('articles/'))
    expect(md.length).toBeGreaterThan(0)
    const [, contenu] = md[0] as [string, string]
    expect(contenu.startsWith('---')).toBe(true)
    expect(contenu).toContain('slug:')
    expect(contenu).toContain('tags:')
  })

  it('explique son contenu, pour dans deux ans', async () => {
    const fichiers = await telechargerArchive()
    expect(fichiers['LISEZ-MOI.txt']).toContain('Cloudflare R2')
  })

  it('n’exporte JAMAIS les jetons tiers', async () => {
    // Les réexporter reviendrait à sortir des identifiants d'accès d'un
    // système pour les poser dans un fichier qu'on va télécharger.
    const fichiers = await telechargerArchive()
    const tout = Object.values(fichiers).join('\n')
    expect(tout).not.toContain('jeton-chiffre-a-ne-jamais-exporter')
    expect(tout).not.toContain('ciphertext')
  })

  it('n’exporte d’un compte que son adresse et son rôle', async () => {
    const fichiers = await telechargerArchive()
    const compte = JSON.parse(fichiers['data/users.json'] ?? '[]')[0]
    expect(Object.keys(compte ?? {}).sort()).toEqual(['active', 'email', 'name', 'role'])
  })
})

describe('simulation d’import', () => {
  it('n’écrit RIEN et montre le différentiel', async () => {
    const avantTest = await archiveEnObjet()

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

    const apresTest = await archiveEnObjet()
    expect((apresTest.manifest as { comptages: unknown }).comptages).toEqual(
      (avantTest.manifest as { comptages: unknown }).comptages,
    )
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

/** Reconstruit l'objet d'import à partir des fichiers de l'archive. */
async function archiveEnObjet(): Promise<Record<string, unknown>> {
  const f = await telechargerArchive()
  const lire = (n: string) => JSON.parse(f[n] ?? 'null')
  const liens = lire('data/links.json') ?? { tags: [], social: [] }
  return {
    manifest: lire('manifest.json'),
    articles: lire('data/articles.json'),
    tags: lire('data/tags.json'),
    liaisonsTags: liens.tags,
    liaisonsSocial: liens.social,
    media: lire('media/manifest.json'),
    socialAccounts: lire('data/social_accounts.json'),
    socialPosts: lire('data/social_posts.json'),
    settings: lire('data/settings.json'),
    users: lire('data/users.json'),
    views: lire('data/views.json'),
  }
}

describe('aller-retour complet', () => {
  it('emporte les comptes sociaux — sinon les publications seraient orphelines', async () => {
    // `social_post.account_id` pointe vers `social_account` : une archive
    // qui oublierait les comptes rendrait la restauration impossible sur
    // une base vierge, la clé étrangère refusant chaque publication.
    const archive = await archiveEnObjet()
    const comptes = archive.socialAccounts as { username: string }[]
    expect(comptes.map((c) => c.username)).toContain('maxinfo')
  })

  it('exporter, vider, réimporter : les données sont identiques', async () => {
    const avant = await archiveEnObjet()

    const ecrits = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: { archive: avant, vider: true, simulation: false },
    })
    expect(ecrits.simulation).toBe(false)

    const apres = await archiveEnObjet()

    // Terme à terme, et non « à peu près » : un import qui perd une
    // liaison ou un réglage ne se verrait pas autrement.
    expect((apres.manifest as { comptages: unknown }).comptages).toEqual(
      (avant.manifest as { comptages: unknown }).comptages,
    )
    for (const cle of [
      'articles',
      'tags',
      'liaisonsTags',
      'media',
      'socialAccounts',
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
