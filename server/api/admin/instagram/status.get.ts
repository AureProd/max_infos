import { desc, eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { secret, socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/** État de la connexion Instagram. Rôle `tech`. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')
  const db = useBase()

  const [jeton] = await db
    .select({ updatedAt: secret.updatedAt })
    .from(secret)
    .where(eq(secret.key, 'instagram_access_token'))
    .limit(1)

  const [derniere] = await db
    .select({ postedAt: socialPost.postedAt, updatedAt: socialPost.updatedAt })
    .from(socialPost)
    .where(eq(socialPost.source, 'api'))
    .orderBy(desc(socialPost.updatedAt))
    .limit(1)

  // Le jeton longue durée vaut 60 jours. On alerte à 15 jours de la fin :
  // passé l'expiration, il ne se rafraîchit plus et il faut refaire l'OAuth
  // à la main.
  const ageJours = jeton ? Math.floor((Date.now() - jeton.updatedAt.getTime()) / 86_400_000) : null

  return {
    connecte: Boolean(jeton),
    jetonAgeJours: ageJours,
    jetonAlerte: ageJours !== null && ageJours > 45,
    derniereSync: derniere?.updatedAt?.toISOString() ?? null,
    dernierePublication: derniere?.postedAt?.toISOString() ?? null,
  }
})
