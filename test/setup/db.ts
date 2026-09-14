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
  process.env.TEST_DATABASE_URL ?? 'postgres://unmaxdinfo:test@127.0.0.1:15432/unmaxdinfo_test' // pragma: allowlist secret

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
