import { eq } from 'drizzle-orm'
import { affichageCompte } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * L'affichage d'un compte sur l'accueil. Rôle `editor`.
 *
 * Ne touche QUE ce que Max décide : visibilité, ordre, nombre de
 * publications. L'identité du compte vient d'Instagram et n'est pas
 * modifiable ici — c'est ce qui garantit qu'elle reste vraie.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  const changements = await readValidatedBody(event, affichageCompte.parse)

  const [ligne] = await useBase()
    .update(socialAccount)
    .set({ ...changements, updatedAt: new Date() })
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
