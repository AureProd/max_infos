import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Connexion à PostgreSQL, ouverte une seule fois par processus.
 *
 * La connexion est paresseuse : rien ne s'ouvre à l'import, sans quoi les
 * tests et le build tenteraient de joindre une base qui n'existe pas.
 */
let client: postgres.Sql | undefined
let base: ReturnType<typeof creerBase> | undefined

function creerBase(connexion: postgres.Sql) {
  // casing doit être déclaré ICI ET dans drizzle.config.ts : sinon la
  // génération des migrations et l'exécution divergent silencieusement.
  return drizzle(connexion, { schema, casing: 'snake_case' })
}

export function useBase() {
  if (!base) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) {
      throw new Error("NUXT_DATABASE_URL n'est pas renseignée")
    }
    client = postgres(databaseUrl, { max: 10, onnotice: () => {} })
    base = creerBase(client)
  }
  return base
}

/**
 * Vérifie que la base répond, et en combien de temps.
 * Utilisée par /api/health/ready et par rien d'autre : le reste du code
 * n'a pas à se demander si la base est joignable, il échoue s'il le faut.
 */
export async function verifierBase(): Promise<{ ok: boolean; latenceMs: number }> {
  const debut = performance.now()
  await useBase().execute(sql`select 1`)
  return { ok: true, latenceMs: Math.round(performance.now() - debut) }
}
