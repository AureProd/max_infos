import { asc, count, like } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { secret, socialAccount, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { tokenKey } from '~~/server/utils/instagram'

/**
 * Les accounts connectés, masqués COMPRIS. Rôle `editor`.
 *
 * Masqués compris, sans quoi un account retiré de l'accueil deviendrait
 * impossible à y remettre.
 *
 * L'état du token est joint here : c'est le même écran qui prévient qu'une
 * reconnexion approche. Sa DATE seule est lue — le `ciphertext` ne quitte
 * jamais la base.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const db = useDatabase()

  const accounts = await db
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

  const tokens = await db
    .select({ key: secret.key, updatedAt: secret.updatedAt })
    .from(secret)
    .where(like(secret.key, 'instagram_access_token:%'))

  const numbers = await db
    .select({ accountId: socialPost.accountId, n: count() })
    .from(socialPost)
    .groupBy(socialPost.accountId)

  return accounts.map((account) => {
    const token = tokens.find((j) => j.key === tokenKey(account.id))
    // Le token longue durée vaut 60 jours. On alerte à 15 jours de la fin :
    // passé l'expiration, il ne se rafraîchit plus et il faut refaire l'OAuth
    // à la main.
    const ageDays = token ? Math.floor((Date.now() - token.updatedAt.getTime()) / 86_400_000) : null

    return {
      ...account,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      url: account.username ? `https://www.instagram.com/${account.username}` : null,
      signedIn: Boolean(token),
      jetonAgeJours: ageDays,
      jetonAlerte: ageDays !== null && ageDays > 45,
      nbPublications: numbers.find((n) => n.accountId === account.id)?.n ?? 0,
    }
  })
})
