import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { appUser, article, articleView } from '../../server/database/schema'
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

    await seedReadings(database(sql))

    writeFileSync(
      ACCOUNTS_FILE,
      JSON.stringify(Object.fromEntries(accounts.map((a) => [a.role, a.id])), null, 2),
    )
  } finally {
    await sql.end()
  }
}

/**
 * Des lectures, pour que les graphiques aient quelque chose à tracer.
 *
 * Le semis de développement ne remplit pas `article_view` : le tableau de
 * bord s'ouvrait donc sur trois cadres vides, et aucun test ne pouvait dire
 * si une courbe se dessine. Les chiffres sont déterministes — un test qui
 * compare des hauteurs de barres ne peut pas dépendre d'un tirage.
 */
async function seedReadings(db: ReturnType<typeof database>): Promise<void> {
  const articles = await db.select({ id: article.id }).from(article)
  if (!articles.length) return

  const rows: { articleId: number; day: string; count: number }[] = []
  for (const [rank, a] of articles.entries()) {
    // Un article sur trois reste sans lecture : c'est le cas qui fait
    // apparaître les jours creux, et c'est celui qui se dessine mal.
    if (rank % 3 === 2) continue
    for (let back = 0; back < 30; back += 2) {
      rows.push({
        articleId: a.id,
        day: new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10),
        count: 3 + ((rank * 7 + back) % 11),
      })
    }
  }
  await db.insert(articleView).values(rows)
}
