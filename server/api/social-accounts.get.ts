import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { socialAccount, socialPost } from '~~/server/database/schema'
import { iso } from '~~/server/utils/serialize'

/**
 * Les accounts affichés sur l'accueil, chacun avec ses dernières publications.
 *
 * Une section par account : c'est cette réponse qui la dessine. Le libellé, la
 * photo et les compteurs viennent du account tel qu'Instagram le donne — rien
 * n'est saisi à la main, donc rien ne peut être falsy longtemps.
 *
 * Les colonnes sont énumérées une à une : ni le token, ni `raw`, la charge
 * brute de Meta, ne doivent pouvoir sortir par inadvertance.
 */
export default defineEventHandler(async () => {
  const db = useDatabase()

  const accounts = await db
    .select({
      id: socialAccount.id,
      username: socialAccount.username,
      displayName: socialAccount.displayName,
      biography: socialAccount.biography,
      avatarUrl: socialAccount.avatarUrl,
      followers: socialAccount.followers,
      mediaCount: socialAccount.mediaCount,
      postsOnHome: socialAccount.postsOnHome,
    })
    .from(socialAccount)
    .where(and(eq(socialAccount.network, 'instagram'), eq(socialAccount.visible, true)))
    .orderBy(asc(socialAccount.position), asc(socialAccount.id))

  if (accounts.length === 0) return []

  // Une seule requête pour toutes les sections, et le filtre des publications
  // masquées EN SQL. La troncature à `postsOnHome`, elle, se fait ensuite :
  // c'est une décision d'affichage, sur quelques dizaines de lines.
  const publications = await db
    .select({
      id: socialPost.id,
      accountId: socialPost.accountId,
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
    .where(
      and(
        eq(socialPost.hidden, false),
        inArray(
          socialPost.accountId,
          accounts.map((c) => c.id),
        ),
      ),
    )
    .orderBy(desc(socialPost.postedAt))

  return accounts.map(({ postsOnHome, ...account }) => ({
    ...account,
    url: account.username ? `https://www.instagram.com/${account.username}` : null,
    publications: publications
      .filter((p) => p.accountId === account.id)
      .slice(0, postsOnHome)
      .map(({ accountId: _compte, ...p }) => ({ ...p, postedAt: iso(p.postedAt) })),
  }))
})
