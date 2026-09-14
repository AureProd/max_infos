import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useBase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )

  const supprimes = await useBase()
    .delete(socialPost)
    .where(eq(socialPost.id, id))
    .returning({ id: socialPost.id })

  if (supprimes.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  }
  return { ok: true as const }
})
