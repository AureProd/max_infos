import { relations } from 'drizzle-orm'
import { articleView } from './analytics'
import { article, articleTag, tag } from './article'
import { media } from './media'
import { articleSocialPost, socialAccount, socialPost } from './social'
import { appUser } from './user'

/**
 * The relations feed Drizzle's `db.query.*` API. They create no SQL
 * constraint: those already live in the tables.
 */

export const articleRelations = relations(article, ({ one, many }) => ({
  cover: one(media, { fields: [article.coverMediaId], references: [media.id] }),
  tags: many(articleTag),
  variants: many(articleSocialPost),
  views: many(articleView),
}))

export const tagRelations = relations(tag, ({ many }) => ({
  articles: many(articleTag),
}))

export const articleTagRelations = relations(articleTag, ({ one }) => ({
  article: one(article, { fields: [articleTag.articleId], references: [article.id] }),
  tag: one(tag, { fields: [articleTag.tagId], references: [tag.id] }),
}))

export const mediaRelations = relations(media, ({ one }) => ({
  uploader: one(appUser, { fields: [media.uploadedBy], references: [appUser.id] }),
}))

export const socialAccountRelations = relations(socialAccount, ({ many }) => ({
  publications: many(socialPost),
}))

export const socialPostRelations = relations(socialPost, ({ one, many }) => ({
  account: one(socialAccount, {
    fields: [socialPost.accountId],
    references: [socialAccount.id],
  }),
  articles: many(articleSocialPost),
}))

export const articleSocialPostRelations = relations(articleSocialPost, ({ one }) => ({
  article: one(article, { fields: [articleSocialPost.articleId], references: [article.id] }),
  socialPost: one(socialPost, {
    fields: [articleSocialPost.socialPostId],
    references: [socialPost.id],
  }),
}))

export const articleViewRelations = relations(articleView, ({ one }) => ({
  article: one(article, { fields: [articleView.articleId], references: [article.id] }),
}))
