import { asc } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Les comptes autorisés. Rôle `tech` EXIGÉ.
 *
 * C'est typiquement l'écran que Max ne doit jamais voir : savoir qui a
 * accès et avec quel rôle relève de l'infrastructure.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')

  return await useBase()
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
