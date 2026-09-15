import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { postVisibility } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Masque ou réaffiche une publication.
 *
 * La synchronisation Instagram ne touche JAMAIS ce field : c'est une
 * décision de Max, qu'un passage automatique n'a pas à défaire.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )
  const { hidden } = await readValidatedBody(event, postVisibility.parse)

  const [update] = await useDatabase()
    .update(socialPost)
    .set({ hidden })
    .where(eq(socialPost.id, id))
    .returning({ id: socialPost.id, hidden: socialPost.hidden })

  if (!update) throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  return update
})
