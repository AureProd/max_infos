import { eq } from 'drizzle-orm'
import {
  SETTING_DEFAULTS,
  SETTING_SCHEMAS,
  SETTING_SCOPE,
  type SettingKey,
  type SettingValue,
} from '#shared/schemas/settings'
import { useBase } from '~~/server/database/client'
import { setting } from '~~/server/database/schema'

/**
 * Lit un réglage, TYPÉ par sa clé.
 *
 * `lireReglage('cv').education.entrees[0].org` est vérifié par le
 * compilateur ; une clé inexistante ne compile pas. C'est ce que permet
 * l'indexation du schéma par clé.
 *
 * Un réglage absent ou mal formé retombe sur les valeurs par défaut du
 * schéma plutôt que de faire échouer la page : un site dont le CV n'est pas
 * encore rempli doit s'afficher.
 */
export async function lireReglage<K extends SettingKey>(cle: K): Promise<SettingValue<K>> {
  const [ligne] = await useBase()
    .select({ value: setting.value })
    .from(setting)
    .where(eq(setting.key, cle))
    .limit(1)

  const resultat = SETTING_SCHEMAS[cle].safeParse(ligne?.value ?? {})
  // Repli sur une valeur par défaut EXPLICITE : `parse({})` échouerait sur
  // les réglages à champs obligatoires, et transformerait un réglage non
  // renseigné en erreur 500.
  return (resultat.success ? resultat.data : SETTING_DEFAULTS[cle]) as SettingValue<K>
}

/** Écrit un réglage, après validation. Sa portée vient du schéma, jamais du client. */
export async function ecrireReglage<K extends SettingKey>(
  cle: K,
  valeur: unknown,
  parQui: number,
): Promise<SettingValue<K>> {
  const valide = SETTING_SCHEMAS[cle].parse(valeur) as SettingValue<K>

  await useBase()
    .insert(setting)
    .values({
      key: cle,
      value: valide,
      // La portée n'est PAS prise dans la requête : un client qui
      // enverrait scope:'public' sur un réglage technique le rendrait
      // visible de tous.
      scope: SETTING_SCOPE[cle],
      updatedBy: parQui,
    })
    .onConflictDoUpdate({
      target: setting.key,
      set: { value: valide, scope: SETTING_SCOPE[cle], updatedBy: parQui, updatedAt: new Date() },
    })

  return valide
}
