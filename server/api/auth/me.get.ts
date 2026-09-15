import { currentUser } from '~~/server/utils/auth'

/**
 * L'user courant, ou null.
 *
 * Répond 200 avec null plutôt que 401 : le site est public, « personne
 * n'est connecté » est un état normal, pas une error.
 */
export default defineEventHandler(async (event) => {
  return { user: await currentUser(event) }
})
