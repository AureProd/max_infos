import { $fetch, setup } from '@nuxt/test-utils/e2e'
import type postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connection, database, migrate, seedTestData, type TestDatabase } from '../setup/db'

/**
 * The posts attached to an article, at the foot of that article.
 *
 * `/api/social-posts?article=<slug>` existed and NOTHING called it: Max
 * attached a publication to an article from the back-office and it appeared
 * on no page. It is also where a LinkedIn post belongs, now that the home
 * page no longer shows the networks it has no account for.
 */
let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
  await seedTestData(db)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

await setup({ server: true, browser: false })

describe('at the foot of an article', () => {
  it('shows the publication attached to it', async () => {
    const html = await $fetch<string>('/article/article-publie')
    expect(html).toContain('Une légende')
  })

  it('says nothing at all on an article with no publication', async () => {
    // An empty heading over an empty grid is worse than no section.
    const html = await $fetch<string>('/article/article-ancien')
    expect(html).not.toContain('Sur les réseaux')
  })

  it('never lets Meta’s raw payload through', async () => {
    expect(await $fetch<string>('/article/article-publie')).not.toContain('ne doit jamais sortir')
  })
})
