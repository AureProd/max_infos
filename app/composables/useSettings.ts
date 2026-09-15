import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/**
 * Reading and writing a setting from the back-office.
 *
 * The server refuses a technical key to an `editor`: this function protects
 * nothing, it merely makes writing convenient and reports the save.
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
