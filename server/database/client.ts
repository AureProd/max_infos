import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * The PostgreSQL connection, opened once per process.
 *
 * The connection is lazy: nothing opens on import, otherwise the tests and
 * the build would try to reach a database that does not exist.
 */
let client: postgres.Sql | undefined
let db: ReturnType<typeof createDatabase> | undefined

function createDatabase(connection: postgres.Sql) {
  // casing must be declared HERE AND in drizzle.config.ts: otherwise
  // migration generation and runtime drift apart silently.
  return drizzle(connection, { schema, casing: 'snake_case' })
}

export function useDatabase() {
  if (!db) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) {
      throw new Error("NUXT_DATABASE_URL n'est pas renseignée")
    }
    client = postgres(databaseUrl, {
      max: 10,
      onnotice: () => {},
      // Unbounded, an unreachable database makes the query wait forever —
      // and the readiness probe, meant to answer « not well » quickly, then
      // never answers at all. An orchestrator waiting for a verdict gets
      // none.
      connect_timeout: 5,
    })
    db = createDatabase(client)
  }
  return db
}

/**
 * Checks that the database answers, and how fast.
 * Used by /api/health/ready and nothing else: the rest of the code has no
 * business wondering whether the database is reachable, it fails if it must.
 */
export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now()
  await useDatabase().execute(sql`select 1`)
  return { ok: true, latencyMs: Math.round(performance.now() - start) }
}
