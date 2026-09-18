import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import {
  article,
  articleSocialPost,
  articleTag,
  media,
  socialPost,
  tag,
} from '~~/server/database/schema'
import { day, iso } from '~~/server/utils/serialize'

/** A published article, with its tags and its social variants. */
export default defineEventHandler(async (event) => {
  // getValidatedRouterParams and not slugParam.parse(): the former turns a
  // validation failure into a 400, the latter lets a ZodError bubble up,
  // which Nitro turns into a 500. A malformed slug is a client error, not a
  // server failure — and a 500 wakes someone on call.
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useDatabase()

  const [trouve] = await db
    .select({
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      bodyHtml: article.bodyHtml,
      publishedAt: article.publishedAt,
      readingMinutes: article.readingMinutes,
      charCount: article.charCount,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      substackUrl: article.substackUrl,
      coverUrl: media.url,
      coverAlt: media.alt,
    })
    .from(article)
    .leftJoin(media, eq(media.id, article.coverMediaId))
    .where(eq(article.slug, slug))
    .limit(1)

  // A draft must be not found, not « forbidden »: answering 403 would
  // reveal its existence.
  if (!trouve?.publishedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  const tags = await db
    .select({ slug: tag.slug, label: tag.label })
    .from(articleTag)
    .innerJoin(article, eq(article.id, articleTag.articleId))
    .innerJoin(tag, eq(tag.id, articleTag.tagId))
    .where(eq(article.slug, slug))
    .orderBy(asc(tag.label))

  const variants = await db
    .select({
      id: socialPost.id,
      network: socialPost.network,
      url: socialPost.url,
      shortcode: socialPost.shortcode,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      postedAt: socialPost.postedAt,
    })
    .from(articleSocialPost)
    .innerJoin(article, eq(article.id, articleSocialPost.articleId))
    .innerJoin(socialPost, eq(socialPost.id, articleSocialPost.socialPostId))
    .where(eq(article.slug, slug))
    .orderBy(asc(articleSocialPost.position))

  return {
    ...trouve,
    publishedAt: day(trouve.publishedAt),
    tags: tags,
    variants: variants.map((d) => ({ ...d, postedAt: iso(d.postedAt) })),
  }
})
