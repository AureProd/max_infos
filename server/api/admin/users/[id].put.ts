import { userUpdate } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { changeUser } from '~~/server/utils/users'

/**
 * Changes a role, an access, or both. Role `tech`.
 *
 * The actor travels with the change: the refusals that matter — demoting
 * oneself, disabling oneself — need to know who is asking. `changeUser`
 * reads the row BEFORE applying them, so a missing account answers 404 and
 * not 409.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, 'tech')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  const changes = await readValidatedBody(event, userUpdate.parse)
  return await changeUser(actor.id, id, changes)
})
