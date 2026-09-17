import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { appUser } from '../../server/database/schema'
import { connection, database, migrate } from '../setup/db'
import { ACCOUNTS_FILE, E2E_DATABASE_URL } from './helpers'

/**
 * The database the browser tests will read, prepared once.
 *
 * Playwright drives a REAL browser against a REAL server, so nothing can be
 * rolled back in a transaction the way the `api` suite does: the server
 * opens its own connections and would see none of it. The database is
 * therefore rebuilt from scratch here, seeded with the mock-up content, and
 * left alone — the browser tests read, they do not write.
 *
 * This is also why `pnpm test:e2e` must never run beside `pnpm test`: both
 * point at the same throwaway database and would truncate each other.
 */
export default async function prepare(): Promise<void> {
  const sql = connection()
  try {
    await migrate(sql)

    // The mock-up content, through the very script that seeds development:
    // an article list assembled by hand here would drift from the real one,
    // and the point of these tests is to look at what Max looks at.
    execFileSync('pnpm', ['seed', '--reset'], {
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      stdio: 'inherit',
    })

    const accounts = await database(sql)
      .insert(appUser)
      .values([
        { email: 'max@e2e.test', name: 'Max', role: 'editor' },
        { email: 'jb@e2e.test', name: 'JB', role: 'developer' },
      ])
      .returning({ id: appUser.id, role: appUser.role })

    writeFileSync(
      ACCOUNTS_FILE,
      JSON.stringify(Object.fromEntries(accounts.map((a) => [a.role, a.id])), null, 2),
    )
  } finally {
    await sql.end()
  }
}
