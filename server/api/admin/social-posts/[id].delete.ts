import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )

  const removed = await useDatabase()
    .delete(socialPost)
    .where(eq(socialPost.id, id))
    .returning({ id: socialPost.id })

  if (removed.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  }
  return { ok: true as const }
})
