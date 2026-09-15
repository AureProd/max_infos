import { and, desc, eq } from 'drizzle-orm'
import { listSocialQuery } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleSocialPost, socialAccount, socialPost } from '~~/server/database/schema'
import { iso } from '~~/server/utils/serialize'

/**
 * Les publications sociales visible.
 *
 * `raw` n'est JAMAIS renvoyé : c'est la charge brute de Meta, elle peut
 * contenir des fields qui n'ont rien à faire sur une page publique.
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
      // Le account d'origine, pour que la page d'une publication sache sous
      // quel @ la signer. Le name d'user est public par nature.
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
