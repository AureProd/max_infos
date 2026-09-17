import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appUser, media, setting } from '../../server/database/schema'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * Restoring a downloaded backup.
 *
 * The site handed out a ZIP and the import accepted nothing but raw JSON:
 * what the Technique screen produced could not be fed back to it, and
 * pulling the production content into a local database was impossible.
 *
 * The archive used here is the one the site ITSELF produces, fetched from
 * /api/admin/export: a test building its own zip would only ever prove that
 * the reader matches the test, not that it matches the export.
 */
let sqlClient: postgres.Sql
let db: TestDatabase
let cookie = ''
let archive: ArrayBuffer

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
  await db.insert(appUser).values({ email: 'jb@zip.test', role: 'tech' })
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

beforeAll(async () => {
  const [me] = await db.select({ id: appUser.id }).from(appUser)
  const r = await fetch('/api/test/session', {
    method: 'POST',
    body: JSON.stringify({ id: me?.id }),
    headers: { 'content-type': 'application/json' },
  })
  cookie = r.headers.get('set-cookie') ?? ''

  archive = await (await fetch('/api/admin/export', { headers: { cookie } })).arrayBuffer()
})

const send = (query: string) =>
  fetch(`/api/admin/import${query}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/zip' },
    body: archive,
  })

describe('the zip the site itself produced', () => {
  it('is read, and its counts are reported before anything is written', async () => {
    const r = await send('?dryRun=true')
    expect(r.status).toBe(200)
    const summary = await r.json()
    expect(summary.dryRun).toBe(true)
    expect(summary.after.articles).toBeGreaterThan(0)
  })

  it('is applied, and puts the articles back', async () => {
    const r = await send('')
    expect(r.status).toBe(200)
    expect((await r.json()).written.articles).toBeGreaterThan(0)
  })
})

describe('choosing what comes back', () => {
  it('writes only what was asked for', async () => {
    const written = (await (await send('?parts=settings')).json()).written
    expect(written.settings).toBeGreaterThan(0)
    expect(written.articles).toBeUndefined()
    expect(written.users).toBeUndefined()
  })

  it('brings the media along with the articles, which point at them', async () => {
    // A cover is a foreign key: restoring the articles alone breaks halfway
    // through, on an insert, long after the boxes were ticked.
    const written = (await (await send('?parts=articles')).json()).written
    expect(written.media).toBeDefined()
    expect(written.tags).toBeDefined()
  })
})

describe('what it refuses', () => {
  it('rejects a file that is not an archive', async () => {
    const r = await fetch('/api/admin/import?dryRun=true', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/zip' },
      body: new TextEncoder().encode('ceci est un texte'),
    })
    expect(r.status).toBe(422)
  })

  it('rejects an empty body', async () => {
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/zip' },
      body: new Uint8Array(),
    })
    expect(r.status).toBe(400)
  })

  it('refuses an editor: restoring is a technical act', async () => {
    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: archive,
    })
    expect(r.status).toBe(401)
  })

  it('still accepts the JSON the command line sends', async () => {
    const summary = await $fetch('/api/admin/import', {
      method: 'POST',
      headers: { cookie },
      body: { archive: { manifest: { version: 2, counts: {} } }, dryRun: true },
    })
    expect(summary.dryRun).toBe(true)
  })
})

/**
 * The trap that made « tout est revenu, sauf à propos ».
 *
 * `setting.updated_by` and `media.uploaded_by` are real foreign keys to
 * `app_user.id`. The export ships those numbers but NOT the user ids
 * (users are exported by email), so a restore rebuilds the accounts with
 * fresh identifiers — and the settings, written last, broke on the foreign
 * key. Everything else was already in place: only « À propos » was missing,
 * and the refusal showed as a discreet line at the bottom of the screen.
 */
describe('a backup whose author has left', () => {
  let signed: ArrayBuffer
  let photoId = 0

  /**
   * Prepared inside the tests, not in a `beforeAll`: the hook of a nested
   * describe runs outside the Nuxt context, and `fetch` has no server to
   * talk to there.
   */
  let prepared: Promise<void> | null = null
  const prepare = (): Promise<void> => {
    prepared ??= (async () => {
      const [author] = await db
        .insert(appUser)
        .values({ email: 'auteur@zip.test', role: 'tech' })
        .returning()
      if (!author) throw new Error('auteur non créé')

      const [photo] = await db
        .insert(media)
        .values({
          url: 'https://exemple.test/max.jpg',
          mime: 'image/jpeg',
          kind: 'image',
          uploadedBy: author.id,
        })
        .returning()
      photoId = photo?.id ?? 0

      await db
        .insert(setting)
        .values({
          key: 'cv',
          value: {
            headline: 'Etudiant en histoire',
            photoMediaId: photoId,
            skills: [{ group: 'Journalisme', items: ['Enquête'] }],
          },
          scope: 'public',
          updatedBy: author.id,
        })
        .onConflictDoUpdate({
          target: setting.key,
          set: {
            value: {
              headline: 'Etudiant en histoire',
              photoMediaId: photoId,
              skills: [{ group: 'Journalisme', items: ['Enquête'] }],
            },
            updatedBy: author.id,
          },
        })

      signed = await (await fetch('/api/admin/export', { headers: { cookie } })).arrayBuffer()

      // He leaves. The database forgets him — the archive does not.
      await db.delete(appUser).where(eq(appUser.id, author.id))
    })()
    return prepared
  }

  const restore = (query: string) =>
    fetch(`/api/admin/import${query}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/zip' },
      body: signed,
    })

  it('puts the settings back although that author is gone', async () => {
    await prepare()
    const r = await restore('?parts=settings&wipe=true')
    expect(r.status).toBe(200)

    const rows = await db.select().from(setting).where(eq(setting.key, 'cv'))
    expect((rows[0]?.value as { headline?: string })?.headline).toBe('Etudiant en histoire')
  })

  it('brings the photo of the CV along with the settings', async () => {
    // `cv.photoMediaId` is a plain integer inside JSON: no foreign key
    // protects it, and a missing row shows as a page without a portrait.
    await prepare()
    const written = (await (await restore('?parts=settings')).json()).written
    expect(written.media).toBeDefined()

    const kept = await db.select().from(media).where(eq(media.id, photoId))
    expect(kept).toHaveLength(1)
  })
})

/**
 * A restore either happens or it does not.
 *
 * It used to write table by table, without a transaction: a refusal at the
 * last step left the database half rewritten, with no way to tell what had
 * landed.
 */
describe('all or nothing', () => {
  it('leaves the settings untouched when a later step fails', async () => {
    const before = await db.select().from(setting).where(eq(setting.key, 'seo'))

    const r = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        archive: {
          manifest: { version: 2, counts: {} },
          settings: [{ key: 'seo', value: { title: 'Écrasé' }, scope: 'public' }],
          // An article that does not exist: the very last step refuses.
          views: [{ articleId: 999_999, day: '2026-01-01', count: 3 }],
        },
        parts: ['settings', 'views'],
        wipe: true,
      }),
    })
    expect(r.status).toBe(422)

    const after = await db.select().from(setting).where(eq(setting.key, 'seo'))
    expect(after.map((r) => r.value)).toEqual(before.map((r) => r.value))
  })
})
