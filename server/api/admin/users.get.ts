import { asc } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Les accounts autorisés. Rôle `tech` EXIGÉ.
 *
 * C'est typiquement l'écran que Max ne doit jamais voir : savoir qui a
 * accès et avec quel rôle relève de l'infrastructure.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'tech')

  return await useDatabase()
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      active: appUser.active,
      lastLoginAt: appUser.lastLoginAt,
    })
    .from(appUser)
    .orderBy(asc(appUser.email))
})
