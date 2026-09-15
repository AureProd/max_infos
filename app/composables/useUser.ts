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
 * The signed-in user, loaded once and shared.
 *
 * We query /api/auth/me rather than read the cookie: the role that counts
 * is the one in the DATABASE, re-read on every request. A revoked right
 * therefore takes effect straight away.
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
     * Hides what the user is not allowed to see.
     *
     * THIS IS NOT SECURITY: it is comfort, so that Max is not shown screens
     * that do not concern him. Security is the server's refusal, checked by
     * test/api/authorization.spec.ts.
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
