import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { postVisibility } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Hides a post or shows it again.
 *
 * The Instagram sync NEVER touches this field: it is Max's decision, and an
 * automatic run has no business undoing it.
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
