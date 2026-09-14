import { asc, count, like } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { secret, socialAccount, socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { cleJeton } from '~~/server/utils/instagram'

/**
 * Les comptes connectés, masqués COMPRIS. Rôle `editor`.
 *
 * Masqués compris, sans quoi un compte retiré de l'accueil deviendrait
 * impossible à y remettre.
 *
 * L'état du jeton est joint ici : c'est le même écran qui prévient qu'une
 * reconnexion approche. Sa DATE seule est lue — le `ciphertext` ne quitte
 * jamais la base.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const db = useBase()

  const comptes = await db
    .select({
      id: socialAccount.id,
      network: socialAccount.network,
      externalId: socialAccount.externalId,
      username: socialAccount.username,
      displayName: socialAccount.displayName,
      biography: socialAccount.biography,
      avatarUrl: socialAccount.avatarUrl,
      followers: socialAccount.followers,
      mediaCount: socialAccount.mediaCount,
      visible: socialAccount.visible,
      position: socialAccount.position,
      postsOnHome: socialAccount.postsOnHome,
      lastSyncAt: socialAccount.lastSyncAt,
    })
    .from(socialAccount)
    .orderBy(asc(socialAccount.position), asc(socialAccount.id))

  const jetons = await db
    .select({ key: secret.key, updatedAt: secret.updatedAt })
    .from(secret)
    .where(like(secret.key, 'instagram_access_token:%'))

  const nombres = await db
    .select({ accountId: socialPost.accountId, n: count() })
    .from(socialPost)
    .groupBy(socialPost.accountId)

  return comptes.map((compte) => {
    const jeton = jetons.find((j) => j.key === cleJeton(compte.id))
    // Le jeton longue durée vaut 60 jours. On alerte à 15 jours de la fin :
    // passé l'expiration, il ne se rafraîchit plus et il faut refaire l'OAuth
    // à la main.
    const ageJours = jeton
      ? Math.floor((Date.now() - jeton.updatedAt.getTime()) / 86_400_000)
      : null

    return {
      ...compte,
      lastSyncAt: compte.lastSyncAt?.toISOString() ?? null,
      url: compte.username ? `https://www.instagram.com/${compte.username}` : null,
      connecte: Boolean(jeton),
      jetonAgeJours: ageJours,
      jetonAlerte: ageJours !== null && ageJours > 45,
      nbPublications: nombres.find((n) => n.accountId === compte.id)?.n ?? 0,
    }
  })
})
