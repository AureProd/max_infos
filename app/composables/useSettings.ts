import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/**
 * Lecture et écriture d'un réglage since le back-office.
 *
 * Le serveur refuse une clé technique à un `editor` : cette fonction ne
 * protège rien, elle rend simplement l'écriture commode et signale
 * l'record.
 */
export function useSetting<K extends SettingKey>(key: K) {
  const value = ref<SettingValue<K> | null>(null)
  const state = ref<'repos' | 'chargement' | 'enregistrement' | 'enregistré' | 'échec'>('repos')

  async function load(): Promise<void> {
    state.value = 'chargement'
    try {
      const all = await $fetch<Record<string, unknown>>('/api/admin/settings', {
        headers: sessionHeaders(),
      })
      value.value = (all[key] ?? null) as SettingValue<K> | null
      state.value = 'repos'
    } catch {
      state.value = 'échec'
    }
  }

  async function save(): Promise<void> {
    if (!value.value) return
    state.value = 'enregistrement'
    try {
      value.value = await $fetch<SettingValue<K>>(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: value.value,
      })
      state.value = 'enregistré'
    } catch {
      state.value = 'échec'
    }
  }

  return { value, state, load, save }
}
