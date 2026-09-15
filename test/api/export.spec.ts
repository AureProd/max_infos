import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { strFromU8, unzipSync } from 'fflate'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, secret } from '../../server/database/schema'
import { base, connection, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * L'aller-back prévu au plan : exporter, vider, réimporter, comparer
 * terme à terme.
 *
 * C'est le seul test qui prouve qu'on peut déménager le site ou repartir
 * d'une base vierge. Le reste n'est que de la confiance.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = base(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values({ email: 'jb@exemple.test', role: 'tech' })
  // Un token chiffré, pour vérifier qu'il ne sort JAMAIS.
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
async function downloadArchive(): Promise<Record<string, string>> {
  const r = await fetch('/api/admin/export', { headers: auth() })
  expect(r.status).toBe(200)
  const bytes = new Uint8Array(await r.arrayBuffer())
  const entries = unzipSync(bytes)
  return Object.fromEntries(
    Object.entries(entries).map(([name, content]) => [
      name.split('/').slice(1).join('/'),
      strFromU8(content),
    ]),
  )
}

describe('export', () => {
  it('produit une VRAIE archive zip, qui s’ouvre', async () => {
    // Une archive qui se télécharge mais ne s'ouvre pas n'est pas une
    // sauvegarde. `unzipSync` échouerait sur un file mal formé.
    const files = await downloadArchive()
    expect(Object.keys(files).length).toBeGreaterThan(5)
  })

  it('se propose en téléchargement, datée', async () => {
    const r = await fetch('/api/admin/export', { headers: auth() })
    expect(r.headers.get('content-type')).toBe('application/zip')
    expect(r.headers.get('content-disposition')).toMatch(
      /attachment; filename="export-\d{4}-\d{2}-\d{2}\.zip"/,
    )
  })

  it('porte une version de schéma et des comptages', async () => {
    const files = await downloadArchive()
    const manifest = JSON.parse(files['manifest.json'] ?? '{}')
    expect(manifest.version).toBe(2)
    expect(manifest.comptages.articles).toBeGreaterThan(0)
  })

  it('contient les articles en MARKDOWN, lisibles tels quels', async () => {
    // Une archive qu'on ne peut ouvrir qu'avec le logiciel qui l'a produite
    // n'est pas une sauvegarde, c'est une dépendance.
    const files = await downloadArchive()
    const md = Object.entries(files).filter(([n]) => n.startsWith('articles/'))
    expect(md.length).toBeGreaterThan(0)
    const [, content] = md[0] as [string, string]
    expect(content.startsWith('---')).toBe(true)
    expect(content).toContain('slug:')
    expect(content).toContain('tags:')
  })

  it('explique son contenu, pour dans deux ans', async () => {
    const files = await downloadArchive()
    expect(files['LISEZ-MOI.txt']).toContain('Cloudflare R2')
  })

  it('n’exporte JAMAIS les jetons tiers', async () => {
    // Les réexporter reviendrait à sortir des identifiants d'accès d'un
    // système pour les set dans un file qu'on va télécharger.
    const files = await downloadArchive()
    const all = Object.values(files).join('\n')
    expect(all).not.toContain('jeton-chiffre-a-ne-jamais-exporter')
    expect(all).not.toContain('ciphertext')
  })

  it('n’exporte d’un compte que son adresse et son rôle', async () => {
    const files = await downloadArchive()
    const account = JSON.parse(files['data/users.json'] ?? '[]')[0]
    expect(Object.keys(account ?? {}).sort()).toEqual(['active', 'email', 'name', 'role'])
  })
})

describe('simulation d’import', () => {
  it('n’écrit RIEN et montre le différentiel', async () => {
    const beforeTest = await archiveToObject()

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
    expect(r.after).toEqual({ articles: 99 })

    const afterTest = await archiveToObject()
    expect((afterTest.manifest as { comptages: unknown }).comptages).toEqual(
      (beforeTest.manifest as { comptages: unknown }).comptages,
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

/** Reconstruit l'object d'import à partir des files de l'archive. */
async function archiveToObject(): Promise<Record<string, unknown>> {
  const f = await downloadArchive()
  const read = (n: string) => JSON.parse(f[n] ?? 'null')
  const links = read('data/links.json') ?? { tags: [], social: [] }
  return {
    manifest: read('manifest.json'),
    articles: read('data/articles.json'),
    tags: read('data/tags.json'),
    liaisonsTags: links.tags,
    liaisonsSocial: links.social,
    media: read('media/manifest.json'),
    socialAccounts: read('data/social_accounts.json'),
    socialPosts: read('data/social_posts.json'),
    settings: read('data/settings.json'),
    users: read('data/users.json'),
    views: read('data/views.json'),
  }
}

describe('aller-retour complet', () => {
  it('emporte les comptes sociaux — sinon les publications seraient orphelines', async () => {
    // `social_post.account_id` pointe vers `social_account` : une archive
    // qui oublierait les accounts rendrait la restauration impossible sur
    // une base vierge, la clé étrangère refusant chaque publication.
    const archive = await archiveToObject()
    const accounts = archive.socialAccounts as { username: string }[]
    expect(accounts.map((c) => c.username)).toContain('maxinfo')
  })

  it('exporter, vider, réimporter : les données sont identiques', async () => {
    const before = await archiveToObject()

    const written = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: { archive: before, vider: true, simulation: false },
    })
    expect(written.simulation).toBe(false)

    const after = await archiveToObject()

    // Terme à terme, et non « à peu près » : un import qui perd une
    // liaison ou un réglage ne se verrait pas autrement.
    expect((after.manifest as { comptages: unknown }).comptages).toEqual(
      (before.manifest as { comptages: unknown }).comptages,
    )
    for (const key of [
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
      expect(after[key], `${key} doit être identique après l'aller-retour`).toEqual(before[key])
    }
  })

  it('le jeton chiffré a SURVÉCU au vidage', async () => {
    // `secret` est volontairement absente du truncate : un import ne doit
    // pas effacer les accès aux accounts tiers.
    const [restant] = await db.select().from(secret)
    expect(restant?.ciphertext).toContain('jeton-chiffre-a-ne-jamais-exporter')
  })

  it('le site public répond toujours après l’aller-retour', async () => {
    const list = await $fetch('/api/articles')
    expect(list.total).toBeGreaterThan(0)
  })
})
