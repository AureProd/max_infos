import { userInvitation } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { inviteUser } from '~~/server/utils/users'

/**
 * Invites an address to the allow list. Role `tech`.
 *
 * No email is sent: the invitation IS the row. The person signs in with
 * Google as usual and is recognised — `signInOrReject` matches on
 * lower(email) and fills the name in.
 *
 * `tech` and not `editor`: whoever can invite can invite themselves as
 * `tech`. Managing accounts therefore stays with JB, as docs/PLAN.md said.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'developer')
  const { email, role } = await readValidatedBody(event, userInvitation.parse)

  const created = await inviteUser(email, role)

  setResponseStatus(event, 201)
  return created
})
