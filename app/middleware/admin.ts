/**
 * Back-office route guard.
 *
 * It avoids showing an empty page to someone who is not signed in. It
 * protects NOTHING: the data only comes from /api/admin/*, which the server
 * refuses independently. Bypassing this guard gives access to no data.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await useFetch<{ user: unknown }>('/api/auth/me', { key: 'utilisateur' })
  if (!data.value?.user) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }
})
