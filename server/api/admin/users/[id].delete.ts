import { requireRole } from '~~/server/utils/auth'
import { removeUser } from '~~/server/utils/users'

/**
 * Deletes an account. Role `tech`.
 *
 * Deactivating is the everyday action — reversible, and effective on the very
 * next request. This one is for erasing an invitation made by mistake: the
 * media and settings the account touched survive but lose their signature,
 * `ON DELETE SET NULL` oblige.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'tech')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  const row = await removeUser(actor.id, id)
  return { supprime: row.id }
})
