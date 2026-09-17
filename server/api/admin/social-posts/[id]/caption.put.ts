import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { postCaption } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Corrects the title of a post.
 *
 * It came from the OpenGraph tags of the pasted page, and nothing could
 * take it back: a title LinkedIn served truncated — or did not serve at
 * all — stayed that way on the site for good.
 *
 * Like `visibility`, this is Max's decision: the Instagram sync overwrites
 * `caption` from the API, so a title corrected by hand on a DISCOVERED post
 * only holds until the next run. On a post typed in by hand, which is every
 * LinkedIn one, nothing ever overwrites it.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { id } = await getValidatedRouterParams(
    event,
    z.object({ id: z.coerce.number().int().positive() }).parse,
  )
  const { caption } = await readValidatedBody(event, postCaption.parse)

  const [update] = await useDatabase()
    .update(socialPost)
    .set({ caption, updatedAt: new Date() })
    .where(eq(socialPost.id, id))
    .returning({ id: socialPost.id, caption: socialPost.caption })

  if (!update) throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  return update
})
