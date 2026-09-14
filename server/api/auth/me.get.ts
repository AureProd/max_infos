import { utilisateurCourant } from '~~/server/utils/auth'

/**
 * L'utilisateur courant, ou null.
 *
 * Répond 200 avec null plutôt que 401 : le site est public, « personne
 * n'est connecté » est un état normal, pas une erreur.
 */
export default defineEventHandler(async (event) => {
  return { user: await utilisateurCourant(event) }
})
