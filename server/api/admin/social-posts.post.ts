import { manualPost } from '#shared/schemas/api'
import { mediaTypeFromUrl } from '#shared/utils/social'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { parseInstagramUrl } from '~~/server/utils/links'

/**
 * Records a post entered by hand.
 *
 * It is the only path for LinkedIn: the `r_member_social` scope is closed
 * to new applications, so reading one's own posts is impossible. A
 * verified constraint, not to be learnt twice.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const d = await readValidatedBody(event, manualPost.parse)

  const ref = d.network === 'instagram' ? parseInstagramUrl(d.url) : null

  const [created] = await useDatabase()
    .insert(socialPost)
    .values({
      network: d.network,
      // No externalId: that comes from the API. NULLs being distinct under
      // PostgreSQL, several manual entries coexist without conflict.
      externalId: null,
      shortcode: ref?.shortcode ?? null,
      url: d.url,
      permalink: d.url,
      /*
       * The link is read before falling back.
       *
       * Every manual entry used to be filed as « image », reels included:
       * the home page then showed a reel as a still photo, labelled
       * « Image ». The permalink says which it is.
       */
      mediaType:
        d.mediaType ?? mediaTypeFromUrl(d.url) ?? (d.network === 'linkedin' ? 'post' : 'image'),
      caption: d.caption ?? null,
      // Read from the link or typed in: a hand-entered post has no media of
      // its own, and the card fell back to a plate saying nothing.
      thumbnailUrl: d.thumbnailUrl ?? null,
      postedAt: d.postedAt ? new Date(`${d.postedAt}T12:00:00Z`) : new Date(),
      source: 'manual',
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
