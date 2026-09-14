import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import {
  article,
  articleSocialPost,
  articleTag,
  media,
  socialPost,
  tag,
} from '~~/server/database/schema'
import { iso, jour } from '~~/server/utils/serialize'

/** Un article publié, avec ses sujets et ses déclinaisons sociales. */
export default defineEventHandler(async (event) => {
  // getValidatedRouterParams et non slugParam.parse() : le premier traduit
  // un échec de validation en 400, le second laisse remonter une ZodError
  // que Nitro transforme en 500. Un slug mal formé est une erreur du
  // client, pas une panne du serveur — et un 500 réveille une astreinte.
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useBase()

  const [trouve] = await db
    .select({
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      bodyMd: article.bodyMd,
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

  // Un brouillon doit être introuvable, pas « interdit » : répondre 403
  // révélerait son existence.
  if (!trouve || !trouve.publishedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  const sujets = await db
    .select({ slug: tag.slug, label: tag.label })
    .from(articleTag)
    .innerJoin(article, eq(article.id, articleTag.articleId))
    .innerJoin(tag, eq(tag.id, articleTag.tagId))
    .where(eq(article.slug, slug))
    .orderBy(asc(tag.label))

  const declinaisons = await db
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
    publishedAt: jour(trouve.publishedAt),
    tags: sujets,
    declinaisons: declinaisons.map((d) => ({ ...d, postedAt: iso(d.postedAt) })),
  }
})
