import type { SettingKey, SettingValue } from '#shared/schemas/settings'
import { reason } from '#shared/utils/errors'

/**
 * Reading and writing a setting from the back-office.
 *
 * The server refuses a technical key to an `editor`: this function protects
 * nothing, it merely makes writing convenient and reports the save.
 */
export function useSetting<K extends SettingKey>(
  key: K,
  /**
   * Ce qui est ENVOYÉ, pas ce qui est affiché.
   *
   * Le nettoyage — retirer une ligne vide, un groupe sans nom — était
   * appliqué à l'état LOCAL avant d'enregistrer. Avec l'enregistrement
   * automatique, un champ qu'on venait d'ajouter disparaissait sous les
   * doigts une seconde plus tard, et l'interrupteur qu'on cliquait ensuite
   * appartenait à une ligne qui n'existait plus. Il s'applique désormais à
   * une COPIE, au moment de l'envoi.
   */
  clean?: (value: SettingValue<K>) => SettingValue<K>,
) {
  // Capturées ICI, où le contexte Nuxt est garanti : `useRequestHeaders()`
  // appelée depuis `load()` — après un await — tombe sur « Nuxt instance
  // unavailable ». Voir le commentaire de useDraft.ts.
  const headers = sessionHeaders()

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
        headers,
      })
      value.value = (all[key] ?? null) as SettingValue<K> | null
      state.value = 'repos'
    } catch (e) {
      state.value = 'échec'
      error.value = reason(e, 'Enregistrement impossible')
    }
  }

  async function save(): Promise<void> {
    if (!value.value) return
    state.value = 'enregistrement'
    error.value = ''
    try {
      /*
       * La réponse n'est PAS réinjectée dans l'état.
       *
       * Le serveur renvoie ce qu'il a écrit, et l'écrire par-dessus l'état
       * local effaçait tout ce qui avait été tapé pendant l'aller-retour —
       * une lettre, une case cochée. L'enregistrement est automatique : cet
       * aller-retour a lieu pendant qu'on travaille, pas après.
       */
      // `$fetch<unknown>` : la réponse n'est pas lue, et sans annotation
      // Nitro tente de faire correspondre le gabarit d'URL à ses routes —
      // le piège que UsersPanel.vue consigne déjà.
      await $fetch<unknown>(`/api/admin/settings/${key}`, {
        method: 'PUT',
        body: clean ? clean(value.value) : value.value,
      })
      state.value = 'enregistré'
    } catch (e) {
      state.value = 'échec'
      error.value = reason(e, 'Enregistrement impossible')
    }
  }

  return { value, state, error, load, save }
}
