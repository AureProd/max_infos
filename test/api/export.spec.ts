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
  it('produces a REAL zip archive, one that opens', async () => {
    // An archive that downloads but does not open is not a backup.
    // `unzipSync` would fail on a malformed file.
    const files = await downloadArchive()
    expect(Object.keys(files).length).toBeGreaterThan(5)
  })

  it('offers itself as a dated download', async () => {
    const r = await fetch('/api/admin/export', { headers: auth() })
    expect(r.headers.get('content-type')).toBe('application/zip')
    expect(r.headers.get('content-disposition')).toMatch(
      /attachment; filename="export-\d{4}-\d{2}-\d{2}\.zip"/,
    )
  })

  it('carries a schema version and counts', async () => {
    const files = await downloadArchive()
    const manifest = JSON.parse(files['manifest.json'] ?? '{}')
    expect(manifest.version).toBe(2)
    expect(manifest.counts.articles).toBeGreaterThan(0)
  })

  it('holds the articles as MARKDOWN, readable as they are', async () => {
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

  it('explains its contents, for two years from now', async () => {
    const files = await downloadArchive()
    expect(files['LISEZ-MOI.txt']).toContain('Cloudflare R2')
  })

  it('NEVER exports third-party tokens', async () => {
    // Re-exporting them would mean taking access credentials out of a
    // system to put them in a file about to be downloaded.
    const files = await downloadArchive()
    const all = Object.values(files).join('\n')
    expect(all).not.toContain('jeton-chiffre-a-ne-jamais-exporter')
    expect(all).not.toContain('ciphertext')
  })

  it("exports only an account's address and role", async () => {
    const files = await downloadArchive()
    const account = JSON.parse(files['data/users.json'] ?? '[]')[0]
    expect(Object.keys(account ?? {}).sort()).toEqual(['active', 'email', 'name', 'role'])
  })
})

describe('import dry run', () => {
  it('writes NOTHING and shows the difference', async () => {
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

  it('refuses an archive of ANOTHER schema version', async () => {
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

describe('full round trip', () => {
  it('carries the social accounts — otherwise the posts would be orphans', async () => {
    // `social_post.account_id` points at `social_account`: an archive
    // forgetting the accounts would make restoring onto a blank database
    // impossible, the foreign key refusing every post.
    const archive = await archiveToObject()
    const accounts = archive.socialAccounts as { username: string }[]
    expect(accounts.map((c) => c.username)).toContain('maxinfo')
  })

  it('export, wipe, re-import: the data is identical', async () => {
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
      expect(after[key], `${key} must be identical after the round trip`).toEqual(before[key])
    }
  })

  it('the encrypted token SURVIVED the wipe', async () => {
    // `secret` is deliberately absent from the truncate: an import must not
    // erase the access to third-party accounts.
    const [restant] = await db.select().from(secret)
    expect(restant?.ciphertext).toContain('jeton-chiffre-a-ne-jamais-exporter')
  })

  it('the public site still answers after the round trip', async () => {
    const list = await $fetch('/api/articles')
    expect(list.total).toBeGreaterThan(0)
  })
})
