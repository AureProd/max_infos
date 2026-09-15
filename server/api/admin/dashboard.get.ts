import { and, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { article, articleSocialPost, articleView, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/** The day, as a short ISO string, shifted by `days` — the `day` column is a bare date. */
function isoDay(jours: number): string {
  const d = new Date(Date.now() + jours * 86_400_000)
  return d.toISOString().slice(0, 10)
}

interface Alert {
  niveau: 'info' | 'attention'
  message: string
  link: string
}

/**
 * What Max must see when he opens the editorial area. Role `editor`.
 *
 * Nothing technical here, not even conditionally: a dashboard that changes
 * shape with the role is a dashboard you cannot describe to its user. The
 * state of Instagram and of the backups lives in the Tech screen, which is
 * made for it.
 *
 * The alerts are things to ACT ON, not statistics: an article published
 * without a cover image will look wrong everywhere it gets shared, and
 * nobody notices that from the article list.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const db = useDatabase()

  const since = isoDay(-6) // aujourd'hui compris, donc sept jours

  const [brouillons, nonRattachees, views, sansCouverture, sansResume, populaires] =
    await Promise.all([
      db
        .select({
          slug: article.slug,
          title: article.title,
          updatedAt: article.updatedAt,
        })
        .from(article)
        .where(eq(article.status, 'draft'))
        .orderBy(desc(article.updatedAt))
        .limit(5),

      // A post without an attached article is unfinished work: it exists on
      // Instagram, but the site does not know what subject it relates to.
      db
        .select({
          id: socialPost.id,
          network: socialPost.network,
          permalink: socialPost.permalink,
          thumbnailUrl: socialPost.thumbnailUrl,
          caption: socialPost.caption,
          postedAt: socialPost.postedAt,
        })
        .from(socialPost)
        .leftJoin(articleSocialPost, eq(articleSocialPost.socialPostId, socialPost.id))
        .where(and(isNull(articleSocialPost.articleId), eq(socialPost.hidden, false)))
        .orderBy(desc(socialPost.postedAt))
        .limit(5),

      db
        .select({ total: sum(articleView.count) })
        .from(articleView)
        .where(gte(articleView.day, since)),

      db
        .select({ n: count() })
        .from(article)
        .where(and(eq(article.status, 'published'), isNull(article.coverMediaId))),

      db
        .select({ n: count() })
        .from(article)
        .where(and(eq(article.status, 'published'), isNull(article.dek))),

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
        .limit(5),
    ])

  const [nbBrouillons] = await db
    .select({ n: count() })
    .from(article)
    .where(eq(article.status, 'draft'))

  const alerts: Alert[] = []
  if ((sansCouverture[0]?.n ?? 0) > 0) {
    alerts.push({
      niveau: 'attention',
      message: `${sansCouverture[0]?.n} article(s) publié(s) sans image de cover`,
      link: '/admin',
    })
  }
  if ((sansResume[0]?.n ?? 0) > 0) {
    alerts.push({
      niveau: 'info',
      message: `${sansResume[0]?.n} article(s) publié(s) sans chapô`,
      link: '/admin',
    })
  }
  if (nonRattachees.length > 0) {
    alerts.push({
      niveau: 'info',
      message: `${nonRattachees.length} publication(s) sans article rattaché`,
      link: '/admin/publications',
    })
  }

  return {
    brouillons: brouillons.map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() })),
    nbBrouillons: nbBrouillons?.n ?? 0,
    nonRattachees: nonRattachees.map((p) => ({
      ...p,
      postedAt: p.postedAt?.toISOString() ?? null,
    })),
    // `sum` returns a string in SQL: the total can exceed the safe integer.
    vuesSemaine: Number(views[0]?.total ?? 0),
    populaires,
    alerts,
  }
})
