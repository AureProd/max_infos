import { eq } from 'drizzle-orm'
import {
  SETTING_DEFAULTS,
  SETTING_SCHEMAS,
  SETTING_SCOPE,
  type SettingKey,
  type SettingValue,
} from '#shared/schemas/settings'
import { useDatabase } from '~~/server/database/client'
import { setting } from '~~/server/database/schema'

/**
 * Reads a setting, TYPED by its key.
 *
 * `readSetting('cv').education.entries[0].org` is checked by the compiler; a
 * key that does not exist does not compile. That is what indexing the
 * schema by key buys.
 *
 * A missing or malformed setting falls back to the schema defaults rather
 * than failing the page: a site whose CV is not filled in yet must still
 * render.
 */
export async function readSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const [row] = await useDatabase()
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, key))
    .limit(1)

  const result = SETTING_SCHEMAS[key].safeParse(row?.value ?? {})
  // Falls back to an EXPLICIT default: `parse({})` would throw on the
  // settings with required fields, and would turn an unset setting into a
  // 500 error.
  return (result.success ? result.data : SETTING_DEFAULTS[key]) as SettingValue<K>
}

/** Writes a setting, after validation. Its scope comes from the schema, never from the client. */
export async function writeSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  parQui: number,
): Promise<SettingValue<K>> {
  const valid = SETTING_SCHEMAS[key].parse(value) as SettingValue<K>

  await useDatabase()
    .insert(setting)
    .values({
      key: key,
      value: valid,
      // The scope is NOT taken from the request: a client sending
      // scope:'public' on a technical setting would make it visible to
      // everyone.
      scope: SETTING_SCOPE[key],
      updatedBy: parQui,
    })
    .onConflictDoUpdate({
      target: setting.key,
      set: { value: valid, scope: SETTING_SCOPE[key], updatedBy: parQui, updatedAt: new Date() },
    })

  return valid
}
