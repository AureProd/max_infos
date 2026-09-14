import type { Role } from '#shared/utils/roles'
import { aLeDroit } from '#shared/utils/roles'

export interface Utilisateur {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role
}

/**
 * L'utilisateur connecté, chargé une fois et partagé.
 *
 * On interroge /api/auth/me plutôt que de lire le cookie : le rôle qui
 * compte est celui de la BASE, relu à chaque requête. Un droit retiré
 * prend ainsi effet tout de suite.
 */
export function useUtilisateur() {
  const { data, refresh } = useFetch<{ user: Utilisateur | null }>('/api/auth/me', {
    key: 'utilisateur',
  })

  const utilisateur = computed(() => data.value?.user ?? null)

  return {
    utilisateur,
    connecte: computed(() => utilisateur.value !== null),
    /**
     * Masque ce que l'utilisateur n'a pas le droit de voir.
     *
     * CE N'EST PAS UNE SÉCURITÉ : c'est du confort, pour que Max ne voie
     * pas des écrans qui ne le concernent pas. La sécurité est le refus du
     * serveur, vérifié par test/api/authorization.spec.ts.
     */
    peut: (requis: Role) => computed(() => aLeDroit(utilisateur.value?.role, requis)),
    rafraichir: refresh,
    deconnecter: async () => {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await refresh()
      await navigateTo('/')
    },
  }
}
