/**
 * Garde de route du back-office.
 *
 * Elle évite d'afficher une page vide à quelqu'un qui n'est pas connecté.
 * Elle ne protège RIEN : les données ne viennent que de /api/admin/*, que
 * le serveur refuse indépendamment. Contourner cette garde ne donne accès
 * à aucune donnée.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await useFetch<{ user: unknown }>('/api/auth/me', { key: 'utilisateur' })
  if (!data.value?.user) {
    return navigateTo(`/connexion?retour=${encodeURIComponent(to.fullPath)}`)
  }
})
