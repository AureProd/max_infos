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
 * Lit un réglage, TYPÉ par sa clé.
 *
 * `readSetting('cv').education.entries[0].org` est vérifié par le
 * compilateur ; une clé inexistante ne compile pas. C'est ce que permet
 * l'indexation du schéma par clé.
 *
 * Un réglage absent ou mal formé retombe sur les values par défaut du
 * schéma plutôt que de faire échouer la page : un site dont le CV n'est pas
 * again rempli doit s'afficher.
 */
export async function readSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const [ligne] = await useDatabase()
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, key))
    .limit(1)

  const result = SETTING_SCHEMAS[key].safeParse(ligne?.value ?? {})
  // Repli sur une value par défaut EXPLICITE : `parse({})` échouerait sur
  // les réglages à fields obligatoires, et transformerait un réglage non
  // renseigné en error 500.
  return (result.success ? result.data : SETTING_DEFAULTS[key]) as SettingValue<K>
}

/** Écrit un réglage, après validation. Sa portée vient du schéma, jamais du client. */
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
      // La portée n'est PAS prise dans la requête : un client qui
      // enverrait scope:'public' sur un réglage technique le rendrait
      // visible de all.
      scope: SETTING_SCOPE[key],
      updatedBy: parQui,
    })
    .onConflictDoUpdate({
      target: setting.key,
      set: { value: valid, scope: SETTING_SCOPE[key], updatedBy: parQui, updatedAt: new Date() },
    })

  return valid
}
