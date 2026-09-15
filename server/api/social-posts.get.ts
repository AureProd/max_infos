import { and, desc, eq } from 'drizzle-orm'
import { listSocialQuery } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleSocialPost, socialAccount, socialPost } from '~~/server/database/schema'
import { iso } from '~~/server/utils/serialize'

/**
 * The visible social posts.
 *
 * `raw` is NEVER returned: it is Meta's payload, and it can hold fields
 * that have no business on a public page.
 */
export default defineEventHandler(async (event) => {
  const { network, article: slug } = await getValidatedQuery(event, listSocialQuery.parse)
  const db = useDatabase()

  const conditions = [eq(socialPost.hidden, false)]
  if (network) conditions.push(eq(socialPost.network, network))

  const base = db
    .select({
      id: socialPost.id,
      network: socialPost.network,
      url: socialPost.url,
      shortcode: socialPost.shortcode,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      thumbnailUrl: socialPost.thumbnailUrl,
      permalink: socialPost.permalink,
      postedAt: socialPost.postedAt,
      // The originating account, so a post's page knows which @ to sign it
      // with. The username is public by nature.
      accountUsername: socialAccount.username,
    })
    .from(socialPost)
    .leftJoin(socialAccount, eq(socialAccount.id, socialPost.accountId))

  const lines = slug
    ? await base
        .innerJoin(articleSocialPost, eq(articleSocialPost.socialPostId, socialPost.id))
        .innerJoin(article, eq(article.id, articleSocialPost.articleId))
        .where(and(...conditions, eq(article.slug, slug)))
        .orderBy(desc(socialPost.postedAt))
    : await base.where(and(...conditions)).orderBy(desc(socialPost.postedAt))

  return lines.map((l) => ({ ...l, postedAt: iso(l.postedAt) }))
})
