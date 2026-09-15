import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'

/**
 * Base PostgreSQL réelle et éphémère, fournie par le service `db-test` du
 * compose de développement (en mémoire, sans durabilité).
 *
 * Chaque test s'exécute dans une transaction annulée à la fin : isolation
 * parfaite, aucun nettoyage, aucune fuite d'un test à l'autre. Le motif ne
 * vaut QUE pour les tests qui utilisent la connexion fournie ici — un
 * handler Nitro ouvre ses propres connexions et ne verrait rien de ce que
 * la transaction a écrit.
 */

// Repli sur la base db-test du compose de développement : éphémère, en
// mémoire, liée à 127.0.0.1.
const URL_TEST =
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15000/unmaxdinfo_test'

export type BaseDeTest = ReturnType<typeof drizzle<typeof schema>>

/** Rejoue toutes les migrations, dans l'ordre du journal. */
export async function migrer(sql: postgres.Sql): Promise<void> {
  const dossier = join(process.cwd(), 'drizzle')
  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  await sql.unsafe('drop schema if exists public cascade; create schema public;')
  for (const fichier of fichiers) {
    const contenu = readFileSync(join(dossier, fichier), 'utf8')
    // drizzle-kit sépare les instructions par ce marqueur.
    for (const instruction of contenu.split('--> statement-breakpoint')) {
      const nettoyee = instruction.trim()
      if (nettoyee) await sql.unsafe(nettoyee)
    }
  }
}

export function connexion(): postgres.Sql {
  return postgres(URL_TEST, { max: 1, onnotice: () => {} })
}

export function base(sql: postgres.Sql): BaseDeTest {
  return drizzle(sql, { schema, casing: 'snake_case' })
}

/**
 * Vérifie qu'une écriture est refusée PAR LA CONTRAINTE ATTENDUE.
 *
 * Drizzle enveloppe l'erreur PostgreSQL : son message ne contient que la
 * requête, et le nom de la contrainte vit dans `cause`. Se contenter de
 * « ça a échoué » laisserait passer un échec pour une tout autre raison —
 * une faute de frappe dans le test, par exemple.
 */
export async function refuseParLaContrainte(
  action: () => Promise<unknown>,
  contrainte: string,
): Promise<void> {
  try {
    await action()
  } catch (erreur) {
    const cause = (erreur as { cause?: unknown }).cause ?? erreur
    const nom = (cause as { constraint_name?: string }).constraint_name
    const message = (cause as { message?: string }).message ?? String(cause)
    if (nom !== contrainte && !message.includes(contrainte)) {
      throw new Error(`Refus attendu par « ${contrainte} », obtenu « ${nom ?? message} »`)
    }
    return
  }
  throw new Error(`L'écriture aurait dû être refusée par « ${contrainte} »`)
}

/**
 * Remplit la base de test avec un jeu minimal et lisible.
 *
 * Volontairement distinct du contenu réel : un test qui dépend des vrais
 * articles casse dès que Max en publie un.
 */
export async function semerJeuDeTest(db: BaseDeTest): Promise<void> {
  const s = await import('../../server/database/schema')

  const [tagGeo] = await db.insert(s.tag).values({ slug: 'geo', label: 'Géographie' }).returning()
  const [tagMem] = await db.insert(s.tag).values({ slug: 'mem', label: 'Alpha' }).returning()

  const [img] = await db
    .insert(s.media)
    .values({ url: 'https://exemple.test/couverture.png', mime: 'image/png', alt: 'Couverture' })
    .returning()

  const [publie] = await db
    .insert(s.article)
    .values({
      slug: 'article-publie',
      title: 'Un article publié',
      dek: 'Son chapô',
      bodyMd: 'Le corps contient le mot rarissime zzyzx.',
      status: 'published',
      publishedAt: new Date('2026-09-10T12:00:00Z'),
      coverMediaId: img?.id ?? null,
      readingMinutes: 4,
      charCount: 1234,
    })
    .returning()

  const [ancien] = await db
    .insert(s.article)
    .values({
      slug: 'article-ancien',
      title: 'Un article plus ancien',
      status: 'published',
      publishedAt: new Date('2026-01-01T12:00:00Z'),
      readingMinutes: 2,
      charCount: 500,
    })
    .returning()

  await db.insert(s.article).values({
    slug: 'article-brouillon',
    title: 'Un brouillon',
    status: 'draft',
  })

  if (publie && tagGeo)
    await db.insert(s.articleTag).values({ articleId: publie.id, tagId: tagGeo.id })
  if (ancien && tagMem)
    await db.insert(s.articleTag).values({ articleId: ancien.id, tagId: tagMem.id })

  // Deux comptes Instagram : un affiché, un masqué. C'est le minimum pour
  // que « une section par compte » se vérifie, et pour qu'un test de fuite
  // ait quelque chose à ne PAS laisser passer.
  const [compte] = await db
    .insert(s.socialAccount)
    .values({
      network: 'instagram',
      externalId: 'IG-1',
      username: 'maxinfo',
      displayName: 'Un Max d’info',
      biography: 'La bio venue d’Instagram',
      avatarUrl: 'https://exemple.test/avatar.png',
      followers: 120,
      mediaCount: 7,
      visible: true,
      position: 0,
      // Volontairement à 1 : la troncature doit se voir.
      postsOnHome: 1,
    })
    .returning()

  const [masque] = await db
    .insert(s.socialAccount)
    .values({
      network: 'instagram',
      externalId: 'IG-2',
      username: 'archives',
      visible: false,
      position: 1,
    })
    .returning()

  const [post] = await db
    .insert(s.socialPost)
    .values({
      network: 'instagram',
      accountId: compte?.id ?? null,
      externalId: 'ABC123',
      shortcode: 'ABC123',
      mediaType: 'reel',
      caption: 'Une légende',
      postedAt: new Date('2026-09-10T12:00:00Z'),
      source: 'api',
      // Sert à vérifier que la charge brute de Meta ne sort JAMAIS d'une
      // réponse d'API. Valeur factice.
      raw: { secret_meta: 'ne doit jamais sortir' },
    })
    .returning()

  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: compte?.id ?? null,
    externalId: 'CACHE1',
    shortcode: 'CACHE1',
    hidden: true,
  })

  // Plus ancienne que ABC123 : c'est elle que la troncature à une
  // publication doit laisser de côté.
  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: compte?.id ?? null,
    externalId: 'DEF456',
    shortcode: 'DEF456',
    postedAt: new Date('2026-01-01T12:00:00Z'),
  })

  // Visible en soi, mais rattachée au compte MASQUÉ : elle ne doit pas
  // paraître sur l'accueil.
  await db.insert(s.socialPost).values({
    network: 'instagram',
    accountId: masque?.id ?? null,
    externalId: 'MASQ1',
    shortcode: 'MASQ1',
    postedAt: new Date('2025-06-01T12:00:00Z'),
  })

  if (publie && post)
    await db.insert(s.articleSocialPost).values({ articleId: publie.id, socialPostId: post.id })

  await db.insert(s.setting).values([
    {
      key: 'identity',
      value: {
        name: 'Site de test',
        author: 'Autrice de test',
        byline: 'AT',
        tagline: '',
        pitch: '',
      },
      scope: 'public',
    },
    // Réglage TECHNIQUE : sert à vérifier qu'il ne sort jamais de /api/site.
    { key: 'instagram', value: { accountId: 'compte-prive-123' }, scope: 'tech' },
  ])
}
