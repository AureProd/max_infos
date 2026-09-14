import { eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { supprimerJeton } from '~~/server/utils/instagram'

/**
 * Déconnecte un compte. Rôle `editor`.
 *
 * DÉFINITIF : le jeton est oublié, la ligne supprimée, et ses publications
 * partent avec elle par la cascade de la clé étrangère — leurs rattachements
 * aux articles compris. C'est la décision prise ; l'écran prévient en
 * annonçant le nombre de publications concernées.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  // Le jeton d'abord : si la suppression de la ligne échouait ensuite, mieux
  // vaut un compte sans jeton — reconnectable — qu'un jeton orphelin que
  // plus rien ne rattache à un compte.
  await supprimerJeton(id)

  const [ligne] = await useBase()
    .delete(socialAccount)
    .where(eq(socialAccount.id, id))
    .returning({ id: socialAccount.id })

  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return { supprime: ligne.id }
})
