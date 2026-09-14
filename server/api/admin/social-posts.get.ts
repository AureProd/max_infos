import { desc, eq, sql } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { socialAccount, socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Toutes les publications, masquées comprises. Rôle `editor`.
 *
 * `raw` reste exclu même ici : Max n'a rien à faire de la charge brute de
 * Meta, et la laisser passer serait une habitude à ne pas prendre.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  return await useBase()
    .select({
      id: socialPost.id,
      network: socialPost.network,
      shortcode: socialPost.shortcode,
      permalink: socialPost.permalink,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      thumbnailUrl: socialPost.thumbnailUrl,
      postedAt: socialPost.postedAt,
      hidden: socialPost.hidden,
      position: socialPost.position,
      source: socialPost.source,
      // De quel compte vient la publication : avec plusieurs comptes, une
      // liste qui ne le dit pas devient illisible. Jointure EXTERNE — une
      // saisie manuelle n'a pas de compte.
      accountId: socialPost.accountId,
      accountUsername: socialAccount.username,
      accountAvatarUrl: socialAccount.avatarUrl,
      // L'article rattaché, en SOUS-REQUÊTE et non en jointure : la table de
      // liaison autorise plusieurs articles par publication, et une jointure
      // dupliquerait alors la ligne. L'écran n'en rattache qu'un.
      articleSlug: sql<string | null>`(
        select a.slug
        from article_social_post asp
        join article a on a.id = asp.article_id
        where asp.social_post_id = ${socialPost.id}
        order by asp.position
        limit 1
      )`,
    })
    .from(socialPost)
    .leftJoin(socialAccount, eq(socialAccount.id, socialPost.accountId))
    .orderBy(desc(socialPost.postedAt))
})
