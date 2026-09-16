import { desc, eq, sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { socialAccount, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Every post, hidden ones included. Role `editor`.
 *
 * `raw` stays excluded even here: Max has no use for Meta's payload, and
 * letting it through would be a habit not worth starting.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  return await useDatabase()
    .select({
      id: socialPost.id,
      network: socialPost.network,
      shortcode: socialPost.shortcode,
      permalink: socialPost.permalink,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      thumbnailUrl: socialPost.thumbnailUrl,
      mediaUrl: socialPost.mediaUrl,
      postedAt: socialPost.postedAt,
      hidden: socialPost.hidden,
      position: socialPost.position,
      source: socialPost.source,
      // Which account the post comes from: with several accounts, a list
      // that does not say becomes unreadable. An OUTER join — a manual
      // entry has no account.
      accountId: socialPost.accountId,
      accountUsername: socialAccount.username,
      accountAvatarUrl: socialAccount.avatarUrl,
      // The attached article, as a SUBQUERY rather than a join: the link
      // table allows several articles per post, and a join would then
      // duplicate the row. The screen only attaches one.
      articleSlug: sql<string | null>`(
        select a.slug
        from article_social_post asp
        join article a on a.id = asp.article_id
        where asp.social_post_id = ${socialPost.id}
        order by asp.position
        limit 1
      )`,
    })
    .from(socialPost)
    .leftJoin(socialAccount, eq(socialAccount.id, socialPost.accountId))
    .orderBy(desc(socialPost.postedAt))
})
