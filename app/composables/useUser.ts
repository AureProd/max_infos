import type { Role } from '#shared/utils/roles'
import { isAllowed } from '#shared/utils/roles'

export interface User {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role
}

/**
 * L'user connecté, chargé une fois et partagé.
 *
 * On interroge /api/auth/me plutôt que de read le cookie : le rôle qui
 * account est celui de la BASE, relu à chaque requête. Un droit retiré
 * prend ainsi effet all de suite.
 */
export function useUser() {
  const { data, refresh } = useFetch<{ user: User | null }>('/api/auth/me', {
    key: 'utilisateur',
  })

  const user = computed(() => data.value?.user ?? null)

  return {
    user,
    signedIn: computed(() => user.value !== null),
    /**
     * Masque ce que l'user n'a pas le droit de voir.
     *
     * CE N'EST PAS UNE SÉCURITÉ : c'est du confort, pour que Max ne voie
     * pas des écrans qui ne le concernent pas. La sécurité est le refus du
     * serveur, vérifié par test/api/authorization.spec.ts.
     */
    peut: (required: Role) => computed(() => isAllowed(user.value?.role, required)),
    refresh: refresh,
    signOut: async () => {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await refresh()
      await navigateTo('/')
    },
  }
}
