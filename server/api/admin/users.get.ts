import { asc } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * The authorized accounts. Role `developer` REQUIRED.
 *
 * This is exactly the screen Max must never see: knowing who has access,
 * and with which role, belongs to the infrastructure.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'developer')

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
