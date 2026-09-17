import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { writeSeedSettings } from '../../scripts/seed/settings'
import { setting } from '../../server/database/schema'
import { connection, database, migrate, type TestDatabase } from '../setup/db'

/**
 * The seed must never erase what Max typed.
 *
 * `cv` is written whole by the seed, with `skills` alone: replayed on a
 * populated database, it wiped the headline, the intro, the education, the
 * experience and the engagements. That is also why « replay the seed in
 * production » was never a repair for the missing compétences.
 */

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
  await sqlClient.unsafe('truncate table setting restart identity cascade')
})

const read = async (): Promise<Record<string, unknown>> => {
  const rows = await db.select().from(setting)
  return (rows.find((r) => r.key === 'cv')?.value ?? {}) as Record<string, unknown>
}

describe('writing the settings of the seed', () => {
  it('writes them when the key is absent', async () => {
    await writeSeedSettings(db, { cv: { skills: [{ group: 'Diffusion', items: ['Newsletter'] }] } })
    expect(await read()).toEqual({ skills: [{ group: 'Diffusion', items: ['Newsletter'] }] })
  })

  it('leaves alone what the key already holds', async () => {
    await db.insert(setting).values({
      key: 'cv',
      value: {
        headline: 'Etudiant en histoire',
        education: { visible: true, entries: [{ title: 'Licence' }] },
      },
      scope: 'public',
    })

    await writeSeedSettings(db, { cv: { skills: [{ group: 'Diffusion', items: ['Newsletter'] }] } })

    const cv = await read()
    expect(cv.headline).toBe('Etudiant en histoire')
    expect(cv.education).toEqual({ visible: true, entries: [{ title: 'Licence' }] })
    // And the key the seed brings, which was missing, is there.
    expect(cv.skills).toEqual([{ group: 'Diffusion', items: ['Newsletter'] }])
  })

  it('does not overwrite a key the seed also carries', async () => {
    await db.insert(setting).values({
      key: 'cv',
      value: { skills: [{ group: 'Journalisme', items: ['Enquête'] }] },
      scope: 'public',
    })

    await writeSeedSettings(db, { cv: { skills: [] } })

    expect((await read()).skills).toEqual([{ group: 'Journalisme', items: ['Enquête'] }])
  })

  it('takes the scope from the table, never from the value', async () => {
    await writeSeedSettings(db, { instagram: { syncIntervalMinutes: 60 } })
    const rows = await db.select().from(setting)
    expect(rows.find((r) => r.key === 'instagram')?.scope).toBe('tech')
  })
})
