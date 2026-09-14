import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { visibilitePublication } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Masque ou réaffiche une publication.
 *
 * La synchronisation Instagram ne touche JAMAIS ce champ : c'est une
 * décision de Max, qu'un passage automatique n'a pas à défaire.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )
  const { hidden } = await readValidatedBody(event, visibilitePublication.parse)

  const [maj] = await useBase()
    .update(socialPost)
    .set({ hidden })
    .where(eq(socialPost.id, id))
    .returning({ id: socialPost.id, hidden: socialPost.hidden })

  if (!maj) throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  return maj
})
