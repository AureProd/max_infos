import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { strFromU8, unzipSync } from 'fflate'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, secret } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * The round trip the plan calls for: export, wipe, re-import, compare item
 * by item.
 *
 * It is the only test proving the site can be moved or restarted from a
 * blank database. Everything else is trust.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values({ email: 'jb@exemple.test', role: 'tech' })
  // An encrypted token, to check it NEVER leaves.
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

/** Fetches the archive and actually unzips it. */
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
    // An archive that downloads but does not open is not a backup.
    // `unzipSync` would fail on a malformed file.
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

  it('porte une version de schéma et des counts', async () => {
    const files = await downloadArchive()
    const manifest = JSON.parse(files['manifest.json'] ?? '{}')
    expect(manifest.version).toBe(2)
    expect(manifest.counts.articles).toBeGreaterThan(0)
  })

  it('contient les articles en MARKDOWN, lisibles tels quels', async () => {
    // An archive you can only open with the software that produced it is
    // not a backup, it is a dependency.
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
    // Re-exporting them would mean taking access credentials out of a
    // system to put them in a file about to be downloaded.
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

describe('dryRun d’import', () => {
  it('n’écrit RIEN et montre le différentiel', async () => {
    const beforeTest = await archiveToObject()

    const r = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: {
        archive: { manifest: { version: 1, counts: { articles: 99 } } },
        wipe: true,
        dryRun: true,
      },
    })
    expect(r.dryRun).toBe(true)
    expect(r.after).toEqual({ articles: 99 })

    const afterTest = await archiveToObject()
    expect((afterTest.manifest as { counts: unknown }).counts).toEqual(
      (beforeTest.manifest as { counts: unknown }).counts,
    )
  })

  it('refuse une archive d’une AUTRE version de schéma', async () => {
    // Writing nonsense would be worse than refusing.
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ archive: { manifest: { version: 99 } }, dryRun: false }),
    })
    expect(r.status).toBe(422)
  })
})

/** Rebuilds the import object from the archive's files. */
async function archiveToObject(): Promise<Record<string, unknown>> {
  const f = await downloadArchive()
  const read = (n: string) => JSON.parse(f[n] ?? 'null')
  const links = read('data/links.json') ?? { tags: [], social: [] }
  return {
    manifest: read('manifest.json'),
    articles: read('data/articles.json'),
    tags: read('data/tags.json'),
    tagLinks: links.tags,
    socialLinks: links.social,
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
    // `social_post.account_id` points at `social_account`: an archive
    // forgetting the accounts would make restoring onto a blank database
    // impossible, the foreign key refusing every post.
    const archive = await archiveToObject()
    const accounts = archive.socialAccounts as { username: string }[]
    expect(accounts.map((c) => c.username)).toContain('maxinfo')
  })

  it('exporter, wipe, réimporter : les données sont identiques', async () => {
    const before = await archiveToObject()

    const written = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: auth(),
      body: { archive: before, wipe: true, dryRun: false },
    })
    expect(written.dryRun).toBe(false)

    const after = await archiveToObject()

    // Item by item, not « roughly »: an import losing a link or a setting
    // would not show any other way.
    expect((after.manifest as { counts: unknown }).counts).toEqual(
      (before.manifest as { counts: unknown }).counts,
    )
    for (const key of [
      'articles',
      'tags',
      'tagLinks',
      'media',
      'socialAccounts',
      'socialPosts',
      'socialLinks',
      'settings',
      'users',
      'views',
    ] as const) {
      expect(after[key], `${key} doit être identique après l'aller-retour`).toEqual(before[key])
    }
  })

  it('le jeton chiffré a SURVÉCU au vidage', async () => {
    // `secret` is deliberately absent from the truncate: an import must not
    // erase the access to third-party accounts.
    const [restant] = await db.select().from(secret)
    expect(restant?.ciphertext).toContain('jeton-chiffre-a-ne-jamais-exporter')
  })

  it('le site public répond toujours après l’aller-retour', async () => {
    const list = await $fetch('/api/articles')
    expect(list.total).toBeGreaterThan(0)
  })
})
