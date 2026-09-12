import { ARTICLES } from './articles'
import { POSTS, IG_POSTS, LI_POSTS } from './posts'

export { ARTICLES, POSTS, IG_POSTS, LI_POSTS }

export const ALL_TAGS = [...new Set(ARTICLES.flatMap((a) => a.tags))].sort((a, b) =>
  a.localeCompare(b, 'fr')
)

export const findArticle = (id) => ARTICLES.find((a) => a.id === id)
export const findPost = (id) => POSTS.find((p) => p.id === id)

/** Les déclinaisons courtes rattachées à un article. */
export const spinoffsOf = (articleId) => POSTS.filter((p) => p.articleId === articleId)
