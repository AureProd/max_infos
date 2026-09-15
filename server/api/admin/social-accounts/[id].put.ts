import { eq } from 'drizzle-orm'
import { accountLabel } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * How an account shows on the home page. Role `editor`.
 *
 * Touches ONLY what Max decides: visibility, order, post count. The account
 * identity comes from Instagram and cannot be edited here — that is what
 * guarantees it stays true.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  const changes = await readValidatedBody(event, accountLabel.parse)

  const [row] = await useDatabase()
    .update(socialAccount)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(socialAccount.id, id))
    .returning({
      id: socialAccount.id,
      visible: socialAccount.visible,
      position: socialAccount.position,
      postsOnHome: socialAccount.postsOnHome,
    })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return row
})
