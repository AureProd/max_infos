import type { Article, Post } from '#shared/types/content'
import { ARTICLES } from './articles'
import { IG_POSTS, LI_POSTS, POSTS } from './posts'

export { ARTICLES, IG_POSTS, LI_POSTS, POSTS }

/**
 * Le tri se fait ICI, en JavaScript, et non en SQL une fois les données en
 * base : les images alpine de PostgreSQL n'embarquent pas les locales ICU
 * complètes, et l'ordre des sujets changerait selon l'image utilisée.
 */
export const ALL_TAGS: string[] = [...new Set(ARTICLES.flatMap((a) => a.tags))].sort((a, b) =>
  a.localeCompare(b, 'fr'),
)

export const findArticle = (id: string): Article | undefined => ARTICLES.find((a) => a.id === id)
export const findPost = (id: string): Post | undefined => POSTS.find((p) => p.id === id)

/** Les déclinaisons courtes rattachées à un article. */
export const spinoffsOf = (articleId: string): Post[] =>
  POSTS.filter((p) => p.articleId === articleId)
