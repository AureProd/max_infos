import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { removeToken } from '~~/server/utils/instagram'

/**
 * Déconnecte un account. Rôle `editor`.
 *
 * DÉFINITIF : le token est oublié, la row supprimée, et ses publications
 * partent avec elle par la cascade de la clé étrangère — leurs rattachements
 * aux articles compris. C'est la décision prise ; l'écran prévient en
 * annonçant le count de publications concernées.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  // Le token d'abord : si la suppression de la row échouait ensuite, mieux
  // vaut un account sans token — reconnectable — qu'un token orphelin que
  // plus rien ne attached à un account.
  await removeToken(id)

  const [row] = await useDatabase()
    .delete(socialAccount)
    .where(eq(socialAccount.id, id))
    .returning({ id: socialAccount.id })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return { supprime: row.id }
})
