import { desc } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Toutes les publications, masquées comprises. Rôle `editor`.
 *
 * `raw` reste exclu même ici : Max n'a rien à faire de la charge brute de
 * Meta, et la laisser passer serait une habitude à ne pas prendre.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  return await useBase()
    .select({
      id: socialPost.id,
      network: socialPost.network,
      shortcode: socialPost.shortcode,
      permalink: socialPost.permalink,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      thumbnailUrl: socialPost.thumbnailUrl,
      postedAt: socialPost.postedAt,
      hidden: socialPost.hidden,
      position: socialPost.position,
      source: socialPost.source,
    })
    .from(socialPost)
    .orderBy(desc(socialPost.postedAt))
})
