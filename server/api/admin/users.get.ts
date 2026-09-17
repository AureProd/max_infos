import { asc } from 'drizzle-orm'
import { asRole } from '#shared/utils/roles'
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

  const rows = await useDatabase()
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      active: appUser.active,
      lastLoginAt: appUser.lastLoginAt,
      // Depuis quand le compte est autorisé : l'écran disait quand il
      // s'était connecté pour la dernière fois, jamais depuis quand il
      // existe — et c'est cette date qui dit si un accès traîne.
      createdAt: appUser.createdAt,
    })
    .from(appUser)
    .orderBy(asc(appUser.email))

  // Le rôle est normalisé à la lecture : la colonne peut encore contenir
  // `tech`, l'ancien nom de `developer`, le temps d'un déploiement.
  return rows.map((r) => ({ ...r, role: asRole(r.role) }))
})
