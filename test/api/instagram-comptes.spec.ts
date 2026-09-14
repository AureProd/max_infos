import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type BaseDeTest, base, connexion, migrer } from '../setup/db'

/**
 * Le service Instagram À PLUSIEURS COMPTES, contre une vraie base.
 *
 * Ces fonctions écrivent : les tester avec un client HTTP simulé mais une
 * base simulée aussi ne prouverait rien de ce qui compte ici — que la
 * synchronisation range chaque publication sous SON compte, et qu'elle ne
 * défasse jamais les décisions de Max.
 *
 * D'où les globales de Nitro fournies à la main : `useBase()` n'a besoin que
 * de `databaseUrl`, et `chiffrer` que de la clé.
 */
const URL_TEST =
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test' // pragma: allowlist secret

// Une clé TIRÉE UNE FOIS : la régénérer à chaque appel rendrait tout
// déchiffrement impossible, ce que le test a d'abord démontré.
const CLE = randomBytes(32).toString('base64')
vi.stubGlobal('useRuntimeConfig', () => ({ databaseUrl: URL_TEST, secretEncryptionKey: CLE }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))
vi.stubGlobal('$fetch', vi.fn())

const s = await import('../../server/database/schema')
const {
  cleJeton,
  comptesInstagram,
  enregistrerCompte,
  enregistrerJeton,
  lireJeton,
  supprimerJeton,
  synchroniser,
} = await import('../../server/utils/instagram')

const profil = (id: string, extra: Record<string, unknown> = {}) => ({
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
let db: BaseDeTest

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
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
    // Un seul jeton pour tout le monde était le modèle d'avant : deux
    // comptes se seraient écrasés l'un l'autre sans le moindre message.
    expect(cleJeton(1)).toBe('instagram_access_token:1')
    expect(cleJeton(2)).not.toBe(cleJeton(1))
  })

  it('range, relit et supprime le jeton du bon compte', async () => {
    await enregistrerJeton(1, 'jeton-un')
    await enregistrerJeton(2, 'jeton-deux')

    expect(await lireJeton(1)).toBe('jeton-un')
    expect(await lireJeton(2)).toBe('jeton-deux')

    await supprimerJeton(1)
    expect(await lireJeton(1)).toBeNull()
    expect(await lireJeton(2)).toBe('jeton-deux')
  })

  it('stocke le jeton CHIFFRÉ, jamais en clair', async () => {
    await enregistrerJeton(1, 'jeton-tres-secret')
    const [ligne] = await db.select().from(s.secret)
    expect(ligne?.ciphertext).not.toContain('jeton-tres-secret')
  })
})

describe('enregistrement du compte', () => {
  it('reprend l’identité du profil Meta', async () => {
    const id = await enregistrerCompte(profil('42'))
    const [compte] = await db.select().from(s.socialAccount).where(eq(s.socialAccount.id, id))

    expect(compte?.externalId).toBe('42')
    expect(compte?.username).toBe('compte42')
    expect(compte?.displayName).toBe('Compte 42')
    expect(compte?.avatarUrl).toBe('https://exemple.test/42.png')
    expect(compte?.followers).toBe(10)
    expect(compte?.lastSyncAt).toBeInstanceOf(Date)
  })

  it('reconnecter un compte connu retombe sur SA ligne', async () => {
    const premier = await enregistrerCompte(profil('42'))
    const second = await enregistrerCompte(profil('42', { username: 'renomme' }))

    expect(second).toBe(premier)
    expect(await db.select().from(s.socialAccount)).toHaveLength(1)
  })

  it('ne défait JAMAIS les réglages d’affichage de Max', async () => {
    // Le piège : une synchronisation qui remet tout à neuf remettrait aussi
    // un compte masqué à l'affiche, sans que personne ne comprenne pourquoi.
    const id = await enregistrerCompte(profil('42'))
    await db
      .update(s.socialAccount)
      .set({ visible: false, position: 3, postsOnHome: 2 })
      .where(eq(s.socialAccount.id, id))

    await enregistrerCompte(profil('42', { username: 'renomme' }))

    const [compte] = await db.select().from(s.socialAccount)
    expect(compte?.username).toBe('renomme')
    expect(compte?.visible).toBe(false)
    expect(compte?.position).toBe(3)
    expect(compte?.postsOnHome).toBe(2)
  })
})

describe('synchronisation, compte par compte', () => {
  it('range chaque publication sous son compte', async () => {
    const un = await enregistrerCompte(profil('1'))
    const deux = await enregistrerCompte(profil('2'))

    await synchroniser([media('A'), media('B')], un)
    await synchroniser([media('C')], deux)

    const lignes = await db.select().from(s.socialPost)
    expect(lignes.filter((l) => l.accountId === un).map((l) => l.externalId)).toEqual(['A', 'B'])
    expect(lignes.filter((l) => l.accountId === deux).map((l) => l.externalId)).toEqual(['C'])
  })

  it('reste idempotente', async () => {
    const un = await enregistrerCompte(profil('1'))
    expect(await synchroniser([media('A')], un)).toEqual({ vues: 1, nouvelles: 1 })
    expect(await synchroniser([media('A')], un)).toEqual({ vues: 1, nouvelles: 0 })
    expect(await db.select().from(s.socialPost)).toHaveLength(1)
  })

  it('ne remet ni le masquage ni la position de Max', async () => {
    const un = await enregistrerCompte(profil('1'))
    await synchroniser([media('A')], un)
    await db.update(s.socialPost).set({ hidden: true, position: 5 })

    await synchroniser([media('A', { caption: 'nouvelle légende' })], un)

    const [ligne] = await db.select().from(s.socialPost)
    expect(ligne?.caption).toBe('nouvelle légende')
    expect(ligne?.hidden).toBe(true)
    expect(ligne?.position).toBe(5)
  })
})

describe('inventaire des comptes à synchroniser', () => {
  it('rend les comptes Instagram, masqués COMPRIS', async () => {
    // Un compte masqué reste synchronisé : le masquer est une décision
    // d'affichage, pas une rupture de la connexion. Le réafficher doit
    // montrer des publications à jour, pas un trou de trois semaines.
    const id = await enregistrerCompte(profil('1'))
    await db.update(s.socialAccount).set({ visible: false }).where(eq(s.socialAccount.id, id))
    await db.insert(s.socialAccount).values({ network: 'linkedin', externalId: 'li-1' })

    const comptes = await comptesInstagram()
    expect(comptes.map((c) => c.externalId)).toEqual(['1'])
  })
})
