import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { isAllowed, type Role } from '#shared/utils/roles'
import { useDatabase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'

export interface SignedInUser {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role
}

/**
 * L'user de la session, ou null.
 *
 * Relit le rôle EN BASE à chaque requête plutôt que de se fier à celui
 * scellé dans le cookie : retirer un rôle ou désactiver un account doit
 * prendre effet all de suite, pas à l'expiration de la session — qui dure
 * quatorze jours.
 */
export async function currentUser(event: H3Event): Promise<SignedInUser | null> {
  const session = await getUserSession(event)
  const id = (session.user as { id?: number } | undefined)?.id
  if (!id) return null

  const [ligne] = await useDatabase()
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      avatarUrl: appUser.avatarUrl,
      role: appUser.role,
      active: appUser.active,
    })
    .from(appUser)
    .where(eq(appUser.id, id))
    .limit(1)

  if (!ligne || !ligne.active) return null
  return {
    id: ligne.id,
    email: ligne.email,
    name: ligne.name,
    avatarUrl: ligne.avatarUrl,
    role: ligne.role,
  }
}

/**
 * Exige une session valid. Répond 401 sinon.
 *
 * 401 et non 403 : le client n'est pas identifié, il peut le devenir en se
 * connectant. Les two codes ne disent pas la même chose à un navigateur.
 */
export async function requireSignIn(event: H3Event): Promise<SignedInUser> {
  const u = await currentUser(event)
  if (!u) throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
  return u
}

/**
 * Exige un rôle au moins égal à celui demandé. Répond 403 sinon.
 *
 * C'est LA fonction du projet à ne pas contourner : toute route
 * `/api/admin/*` passe par elle. Le test paramétré de
 * test/api/authorization.spec.ts vérifie qu'aucune n'y échappe.
 */
export async function requireRole(event: H3Event, required: Role): Promise<SignedInUser> {
  const u = await requireSignIn(event)
  if (!isAllowed(u.role, required)) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }
  return u
}

/**
 * Trouve ou crée le account correspondant à une adresse Google.
 *
 * LISTE BLANCHE : personne ne se crée de account. Une adresse inconnue est
 * refusée, sauf si elle est celle du account technique d'amorçage — le seul
 * moyen d'avoir un first user sur une base vierge.
 */
export async function signInOrReject(profile: {
  email: string
  name?: string | null
  avatarUrl?: string | null
}): Promise<SignedInUser> {
  const db = useDatabase()
  const email = profile.email.trim()
  const { bootstrapTechEmail } = useRuntimeConfig()

  // Comparaison insensible à la casse : Google renvoie l'adresse avec une
  // casse variable, et l'index unique de la table est lui aussi sur
  // lower(email).
  const [existant] = await db
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      avatarUrl: appUser.avatarUrl,
      role: appUser.role,
      active: appUser.active,
    })
    .from(appUser)
    .where(sql`lower(${appUser.email}) = lower(${email})`)
    .limit(1)

  if (existant) {
    if (!existant.active) {
      throw createError({ statusCode: 403, statusMessage: 'Compte désactivé' })
    }
    await db
      .update(appUser)
      .set({ lastLoginAt: new Date(), name: profile.name ?? existant.name })
      .where(eq(appUser.id, existant.id))
    return {
      id: existant.id,
      email: existant.email,
      name: profile.name ?? existant.name,
      avatarUrl: profile.avatarUrl ?? existant.avatarUrl,
      role: existant.role,
    }
  }

  const bootstrap = bootstrapTechEmail.trim()
  if (!bootstrap || bootstrap.toLowerCase() !== email.toLowerCase()) {
    throw createError({ statusCode: 403, statusMessage: 'Adresse non autorisée' })
  }

  const [created] = await db
    .insert(appUser)
    .values({
      email,
      name: profile.name ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      role: 'tech',
      lastLoginAt: new Date(),
    })
    .returning({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      avatarUrl: appUser.avatarUrl,
      role: appUser.role,
    })

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Création impossible' })
  return created
}
