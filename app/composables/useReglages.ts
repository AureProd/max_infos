import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/**
 * Lecture et écriture d'un réglage depuis le back-office.
 *
 * Le serveur refuse une clé technique à un `editor` : cette fonction ne
 * protège rien, elle rend simplement l'écriture commode et signale
 * l'enregistrement.
 */
export function useReglage<K extends SettingKey>(cle: K) {
  const valeur = ref<SettingValue<K> | null>(null)
  const etat = ref<'repos' | 'chargement' | 'enregistrement' | 'enregistré' | 'échec'>('repos')

  async function charger(): Promise<void> {
    etat.value = 'chargement'
    try {
      const tout = await $fetch<Record<string, unknown>>('/api/admin/settings', {
        headers: enTetesDeSession(),
      })
      valeur.value = (tout[cle] ?? null) as SettingValue<K> | null
      etat.value = 'repos'
    } catch {
      etat.value = 'échec'
    }
  }

  async function enregistrer(): Promise<void> {
    if (!valeur.value) return
    etat.value = 'enregistrement'
    try {
      valeur.value = await $fetch<SettingValue<K>>(`/api/admin/settings/${cle}`, {
        method: 'PUT',
        body: valeur.value,
      })
      etat.value = 'enregistré'
    } catch {
      etat.value = 'échec'
    }
  }

  return { valeur, etat, charger, enregistrer }
}
