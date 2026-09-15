import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The MULTI-ACCOUNT Instagram service, against a real database.
 *
 * These functions write: testing them with a stub HTTP client but a stub
 * database as well would prove nothing of what counts here — that the sync
 * files every post under ITS account, and that it never undoes Max's
 * decisions.
 *
 * Hence the Nitro globals supplied by hand: `useDatabase()` only needs
 * `databaseUrl`, and `encrypt` only the key.
 */
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test'

// A key DRAWN ONCE: regenerating it on every call would make any
// decryption impossible, which the test demonstrated first.
const KEY = randomBytes(32).toString('base64')
vi.stubGlobal('useRuntimeConfig', () => ({ databaseUrl: TEST_URL, secretEncryptionKey: KEY }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))
vi.stubGlobal('$fetch', vi.fn())

const s = await import('../../server/database/schema')
const { tokenKey, instagramAccounts, saveAccount, saveToken, readToken, removeToken, syncPosts } =
  await import('../../server/utils/instagram')

const profile = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  username: `compte${id}`,
  name: `Compte ${id}`,
  biography: 'Une bio',
  profile_picture_url: `https://exemple.test/${id}.png`,
  followers_count: 10,
  media_count: 3,
  ...extra,
})

const media = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  media_type: 'IMAGE' as const,
  permalink: `https://www.instagram.com/p/${id}/`,
  timestamp: '2026-09-10T12:00:00+0000',
  ...extra,
})

let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe(
    'truncate table social_post, social_account, secret restart identity cascade',
  )
})

describe('le jeton appartient au compte', () => {
  it('dérive une clé par compte', () => {
    // A single token for everyone was the previous model: two accounts
    // would have overwritten each other without a single message.
    expect(tokenKey(1)).toBe('instagram_access_token:1')
    expect(tokenKey(2)).not.toBe(tokenKey(1))
  })

  it('range, relit et supprime le jeton du bon compte', async () => {
    await saveToken(1, 'jeton-un')
    await saveToken(2, 'jeton-deux')

    expect(await readToken(1)).toBe('jeton-un')
    expect(await readToken(2)).toBe('jeton-deux')

    await removeToken(1)
    expect(await readToken(1)).toBeNull()
    expect(await readToken(2)).toBe('jeton-deux')
  })

  it('stocke le jeton CHIFFRÉ, jamais en clair', async () => {
    await saveToken(1, 'jeton-tres-secret')
    const [row] = await db.select().from(s.secret)
    expect(row?.ciphertext).not.toContain('jeton-tres-secret')
  })
})

describe('enregistrement du compte', () => {
  it('reprend l’identité du profil Meta', async () => {
    const id = await saveAccount(profile('42'))
    const [account] = await db.select().from(s.socialAccount).where(eq(s.socialAccount.id, id))

    expect(account?.externalId).toBe('42')
    expect(account?.username).toBe('compte42')
    expect(account?.displayName).toBe('Compte 42')
    expect(account?.avatarUrl).toBe('https://exemple.test/42.png')
    expect(account?.followers).toBe(10)
    expect(account?.lastSyncAt).toBeInstanceOf(Date)
  })

  it('reconnecter un compte connu retombe sur SA ligne', async () => {
    const first = await saveAccount(profile('42'))
    const second = await saveAccount(profile('42', { username: 'renomme' }))

    expect(second).toBe(first)
    expect(await db.select().from(s.socialAccount)).toHaveLength(1)
  })

  it('ne défait JAMAIS les réglages d’affichage de Max', async () => {
    // The trap: a sync that resets everything would also put a hidden
    // account back on display, with nobody understanding why.
    const id = await saveAccount(profile('42'))
    await db
      .update(s.socialAccount)
      .set({ visible: false, position: 3, postsOnHome: 2 })
      .where(eq(s.socialAccount.id, id))

    await saveAccount(profile('42', { username: 'renomme' }))

    const [account] = await db.select().from(s.socialAccount)
    expect(account?.username).toBe('renomme')
    expect(account?.visible).toBe(false)
    expect(account?.position).toBe(3)
    expect(account?.postsOnHome).toBe(2)
  })
})

describe('synchronisation, compte par compte', () => {
  it('range chaque publication sous son compte', async () => {
    const un = await saveAccount(profile('1'))
    const two = await saveAccount(profile('2'))

    await syncPosts([media('A'), media('B')], un)
    await syncPosts([media('C')], two)

    const lines = await db.select().from(s.socialPost)
    expect(lines.filter((l) => l.accountId === un).map((l) => l.externalId)).toEqual(['A', 'B'])
    expect(lines.filter((l) => l.accountId === two).map((l) => l.externalId)).toEqual(['C'])
  })

  it('reste idempotente', async () => {
    const un = await saveAccount(profile('1'))
    expect(await syncPosts([media('A')], un)).toEqual({ views: 1, fresh: 1 })
    expect(await syncPosts([media('A')], un)).toEqual({ views: 1, fresh: 0 })
    expect(await db.select().from(s.socialPost)).toHaveLength(1)
  })

  it('ne remet ni le masquage ni la position de Max', async () => {
    const un = await saveAccount(profile('1'))
    await syncPosts([media('A')], un)
    await db.update(s.socialPost).set({ hidden: true, position: 5 })

    await syncPosts([media('A', { caption: 'nouvelle légende' })], un)

    const [row] = await db.select().from(s.socialPost)
    expect(row?.caption).toBe('nouvelle légende')
    expect(row?.hidden).toBe(true)
    expect(row?.position).toBe(5)
  })
})

describe('inventaire des comptes à synchroniser', () => {
  it('rend les comptes Instagram, masqués COMPRIS', async () => {
    // A hidden account stays synced: hiding it is a display decision, not a
    // broken connection. Showing it again must reveal up-to-date posts, not
    // a three-week gap.
    const id = await saveAccount(profile('1'))
    await db.update(s.socialAccount).set({ visible: false }).where(eq(s.socialAccount.id, id))
    await db.insert(s.socialAccount).values({ network: 'linkedin', externalId: 'li-1' })

    const accounts = await instagramAccounts()
    expect(accounts.map((c) => c.externalId)).toEqual(['1'])
  })
})
