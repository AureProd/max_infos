import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/**
 * Whatever the server was willing to say — never an empty string.
 *
 * `??` alone is not enough: ofetch fills `data.message` with '' rather than
 * leaving it out, and an empty reason displays as no reason at all, which
 * is the very silence being fixed here.
 */
function reason(e: unknown): string {
  const err = e as { statusMessage?: string; data?: { message?: string }; message?: string }
  const said = [err.data?.message, err.statusMessage, err.message].find(
    (s) => typeof s === 'string' && s.trim() !== '',
  )
  return said ?? 'Enregistrement impossible'
}

/**
 * Reading and writing a setting from the back-office.
 *
 * The server refuses a technical key to an `editor`: this function protects
 * nothing, it merely makes writing convenient and reports the save.
 */
export function useSetting<K extends SettingKey>(key: K) {
  const value = ref<SettingValue<K> | null>(null)
  const state = ref<'repos' | 'chargement' | 'enregistrement' | 'enregistré' | 'échec'>('repos')
  /**
   * WHY the last save failed.
   *
   * A refusal from validation used to be caught and dropped: the screen
   * said « échec » and Max had no way to learn which field was wrong — he
   * only saw a form that would not stick.
   */
  const error = ref('')

  async function load(): Promise<void> {
    state.value = 'chargement'
    try {
      const all = await $fetch<Record<string, unknown>>('/api/admin/settings', {
        headers: sessionHeaders(),
      })
      value.value = (all[key] ?? null) as SettingValue<K> | null
      state.value = 'repos'
    } catch (e) {
      state.value = 'échec'
      error.value = reason(e)
    }
  }

  async function save(): Promise<void> {
    if (!value.value) return
    state.value = 'enregistrement'
    error.value = ''
    try {
      value.value = await $fetch<SettingValue<K>>(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: value.value,
      })
      state.value = 'enregistré'
    } catch (e) {
      state.value = 'échec'
      error.value = reason(e)
    }
  }

  return { value, state, error, load, save }
}
