import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import {
  article,
  articleSocialPost,
  articleTag,
  articleView,
  socialPost,
  tag,
} from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { dayRange, fillDays, isoDay } from '~~/server/utils/stats'

/** La fenêtre des graphiques. Trente jours : assez pour voir une tendance. */
const WINDOW = 30

/**
 * What the dashboard draws. Role `editor`.
 *
 * Deliberately separate from `/api/admin/dashboard`, which answers « what
 * is there to do ». This one answers « what is being read », and it is the
 * expensive one: three aggregates over the whole view table. Keeping them
 * apart means the to-do list still appears instantly when the graphs are
 * slow, instead of the whole screen waiting on a `group by`.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const db = useDatabase()

  const since = isoDay(-(WINDOW - 1))
  const days = dayRange(since, isoDay(0))

  const [parJour, parArticle, parTag, rattachees, publications] = await Promise.all([
    db
      .select({ day: articleView.day, views: sql<number>`sum(${articleView.count})::int` })
      .from(articleView)
      .where(gte(articleView.day, since))
      .groupBy(articleView.day),

    db
      .select({
        slug: article.slug,
        title: article.title,
        views: sql<number>`sum(${articleView.count})::int`,
      })
      .from(articleView)
      .innerJoin(article, eq(article.id, articleView.articleId))
      .where(gte(articleView.day, since))
      .groupBy(article.slug, article.title)
      .orderBy(desc(sql`sum(${articleView.count})`))
      .limit(8),

    /*
     * Ce que Max a demandé : quels TAGS fonctionnent.
     *
     * Un article porte plusieurs tags, donc ses lectures comptent pour
     * chacun d'eux. La somme des colonnes dépasse alors le total du site —
     * c'est voulu, et la légende le dit : on compare des sujets entre eux,
     * on ne répartit pas un gâteau.
     */
    db
      .select({
        label: tag.label,
        slug: tag.slug,
        views: sql<number>`sum(${articleView.count})::int`,
        articles: sql<number>`count(distinct ${article.id})::int`,
      })
      .from(articleView)
      .innerJoin(article, eq(article.id, articleView.articleId))
      .innerJoin(articleTag, eq(articleTag.articleId, article.id))
      .innerJoin(tag, eq(tag.id, articleTag.tagId))
      .where(gte(articleView.day, since))
      .groupBy(tag.label, tag.slug)
      .orderBy(desc(sql`sum(${articleView.count})`))
      .limit(8),

    db
      .select({ n: count() })
      .from(socialPost)
      .innerJoin(articleSocialPost, eq(articleSocialPost.socialPostId, socialPost.id))
      .where(eq(socialPost.hidden, false)),

    db.select({ n: count() }).from(socialPost).where(eq(socialPost.hidden, false)),
  ])

  const [sansCouverture] = await db
    .select({ n: count() })
    .from(article)
    .where(and(eq(article.status, 'published'), isNull(article.coverMediaId)))

  return {
    fenetre: WINDOW,
    // Un point par jour, zéro compris : sans cela la courbe relie deux
    // lectures distantes de quatre jours par une droite, et invente un
    // trafic régulier qui n'a jamais eu lieu.
    parJour: fillDays(parJour, days),
    parArticle,
    parTag,
    rattachement: {
      liees: rattachees[0]?.n ?? 0,
      total: publications[0]?.n ?? 0,
    },
    sansCouverture: sansCouverture?.n ?? 0,
  }
})
