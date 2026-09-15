import { eq } from 'drizzle-orm'
import { accountLabel } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * L'affichage d'un account sur l'accueil. Rôle `editor`.
 *
 * Ne touche QUE ce que Max décide : visibilité, ordre, nombre de
 * publications. L'identité du account vient d'Instagram et n'est pas
 * modifiable here — c'est ce qui garantit qu'elle reste vraie.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  const changes = await readValidatedBody(event, accountLabel.parse)

  const [ligne] = await useDatabase()
    .update(socialAccount)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(socialAccount.id, id))
    .returning({
      id: socialAccount.id,
      visible: socialAccount.visible,
      position: socialAccount.position,
      postsOnHome: socialAccount.postsOnHome,
    })

  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return ligne
})
