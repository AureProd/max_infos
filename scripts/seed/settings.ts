import { sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../server/database/schema'
import { SETTING_SCOPE, type SettingKey } from '../../shared/schemas/settings'

type Database = ReturnType<typeof drizzle<typeof schema>>

/**
 * Writes the settings of the seed WITHOUT erasing what is already there.
 *
 * The seed used to rewrite each key whole. `cv` carries `skills` alone, so
 * replaying the seed on a populated database wiped the headline, the intro
 * and every dated section Max had typed in the back-office.
 *
 * `excluded.value || setting.value` merges key by key, and the ORDER is the
 * whole point: what the database holds wins, the seed only fills in what is
 * missing. Emptying a database is the job of `--reset`, not of an upsert.
 */
export async function writeSeedSettings(
  db: Database,
  settings: Record<string, unknown>,
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await db
      .insert(schema.setting)
      // The scope comes from the table, never from a value written here.
      .values({ key, value, scope: SETTING_SCOPE[key as SettingKey] ?? 'public' })
      .onConflictDoUpdate({
        target: schema.setting.key,
        set: {
          value: sql`excluded.value || ${schema.setting.value}`,
          updatedAt: sql`now()`,
        },
      })
  }
}
