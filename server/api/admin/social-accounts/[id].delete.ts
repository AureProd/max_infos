import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { socialAccount } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { removeToken } from '~~/server/utils/instagram'

/**
 * Disconnects an account. Role `editor`.
 *
 * FINAL: the token is forgotten, the row deleted, and its posts go with it
 * through the foreign key cascade — including their attachments to
 * articles. That is the decision taken; the screen warns by announcing how
 * many posts are affected.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte invalide' })
  }

  // The token first: should deleting the row fail afterwards, an account
  // without a token — reconnectable — beats an orphaned token nothing
  // attaches to an account any more.
  await removeToken(id)

  const [row] = await useDatabase()
    .delete(socialAccount)
    .where(eq(socialAccount.id, id))
    .returning({ id: socialAccount.id })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return { supprime: row.id }
})
