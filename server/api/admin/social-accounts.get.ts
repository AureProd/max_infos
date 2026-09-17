import { asc, count, like } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { secret, socialAccount, socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { tokenKey } from '~~/server/utils/instagram'

/**
 * The connected accounts, hidden ones INCLUDED. Role `editor`.
 *
 * Hidden ones included, otherwise an account removed from the home page
 * would become impossible to put back.
 *
 * The token state is joined here: it is the same screen that warns a
 * reconnection is coming. Only its DATE is read — the `ciphertext` never
 * leaves the database.
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
      // La date de connexion : l'écran disait quand le compte avait été
      // synchronisé pour la dernière fois, jamais depuis quand il est là.
      createdAt: socialAccount.createdAt,
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
    // The long-lived token lasts 60 days. We warn 15 days before the end:
    // past expiry it cannot be refreshed any more, and the OAuth dance has
    // to be redone by hand.
    const ageDays = token ? Math.floor((Date.now() - token.updatedAt.getTime()) / 86_400_000) : null

    return {
      ...account,
      lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      url: account.username ? `https://www.instagram.com/${account.username}` : null,
      signedIn: Boolean(token),
      jetonAgeJours: ageDays,
      jetonAlerte: ageDays !== null && ageDays > 45,
      nbPublications: numbers.find((n) => n.accountId === account.id)?.n ?? 0,
    }
  })
})
