import { and, desc, eq } from 'drizzle-orm'
import { listeSocialQuery } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article, articleSocialPost, socialPost } from '~~/server/database/schema'
import { iso } from '~~/server/utils/serialize'

/**
 * Les publications sociales visibles.
 *
 * `raw` n'est JAMAIS renvoyé : c'est la charge brute de Meta, elle peut
 * contenir des champs qui n'ont rien à faire sur une page publique.
 */
export default defineEventHandler(async (event) => {
  const { network, article: slug } = await getValidatedQuery(event, listeSocialQuery.parse)
  const db = useBase()

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
    })
    .from(socialPost)

  const lignes = slug
    ? await base
        .innerJoin(articleSocialPost, eq(articleSocialPost.socialPostId, socialPost.id))
        .innerJoin(article, eq(article.id, articleSocialPost.articleId))
        .where(and(...conditions, eq(article.slug, slug)))
        .orderBy(desc(socialPost.postedAt))
    : await base.where(and(...conditions)).orderBy(desc(socialPost.postedAt))

  return lignes.map((l) => ({ ...l, postedAt: iso(l.postedAt) }))
})
