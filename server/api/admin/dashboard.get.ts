import { and, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { article, articleSocialPost, articleView, socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/** Le jour, en ISO court, décalé de `jours` — la colonne `day` est une date nue. */
function jourIso(jours: number): string {
  const d = new Date(Date.now() + jours * 86_400_000)
  return d.toISOString().slice(0, 10)
}

interface Alerte {
  niveau: 'info' | 'attention'
  message: string
  lien: string
}

/**
 * Ce que Max doit voir en ouvrant la rédaction. Rôle `editor`.
 *
 * Rien de technique ici, pas même conditionnellement : un tableau de bord
 * qui change de forme selon le rôle est un tableau de bord qu'on ne peut
 * pas décrire à son utilisateur. L'état d'Instagram et des sauvegardes vit
 * dans l'écran Technique, qui est fait pour ça.
 *
 * Les alertes sont des choses SUR LESQUELLES AGIR, pas des statistiques :
 * un article publié sans image de couverture s'affichera mal partout où il
 * sera partagé, et personne ne s'en aperçoit depuis la liste d'articles.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const db = useBase()

  const depuis = jourIso(-6) // aujourd'hui compris, donc sept jours

  const [brouillons, nonRattachees, vues, sansCouverture, sansResume, populaires] =
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

      // Une publication sans article rattaché est du travail resté en
      // suspens : elle existe sur Instagram, mais le site ne sait pas à
      // quel sujet elle se rapporte.
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
        .where(gte(articleView.day, depuis)),

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
          vues: sql<number>`sum(${articleView.count})::int`,
        })
        .from(articleView)
        .innerJoin(article, eq(article.id, articleView.articleId))
        .where(gte(articleView.day, depuis))
        .groupBy(article.slug, article.title)
        .orderBy(desc(sql`sum(${articleView.count})`))
        .limit(5),
    ])

  const [nbBrouillons] = await db
    .select({ n: count() })
    .from(article)
    .where(eq(article.status, 'draft'))

  const alertes: Alerte[] = []
  if ((sansCouverture[0]?.n ?? 0) > 0) {
    alertes.push({
      niveau: 'attention',
      message: `${sansCouverture[0]?.n} article(s) publié(s) sans image de couverture`,
      lien: '/admin',
    })
  }
  if ((sansResume[0]?.n ?? 0) > 0) {
    alertes.push({
      niveau: 'info',
      message: `${sansResume[0]?.n} article(s) publié(s) sans chapô`,
      lien: '/admin',
    })
  }
  if (nonRattachees.length > 0) {
    alertes.push({
      niveau: 'info',
      message: `${nonRattachees.length} publication(s) sans article rattaché`,
      lien: '/admin/publications',
    })
  }

  return {
    brouillons: brouillons.map((b) => ({ ...b, updatedAt: b.updatedAt.toISOString() })),
    nbBrouillons: nbBrouillons?.n ?? 0,
    nonRattachees: nonRattachees.map((p) => ({
      ...p,
      postedAt: p.postedAt?.toISOString() ?? null,
    })),
    // `sum` rend une chaîne en SQL : le total peut dépasser l'entier sûr.
    vuesSemaine: Number(vues[0]?.total ?? 0),
    populaires,
    alertes,
  }
})
