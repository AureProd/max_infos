import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { aLeDroit, type Role } from '#shared/utils/roles'
import { useBase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'

export interface UtilisateurConnecte {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role
}

/**
 * L'utilisateur de la session, ou null.
 *
 * Relit le rôle EN BASE à chaque requête plutôt que de se fier à celui
 * scellé dans le cookie : retirer un rôle ou désactiver un compte doit
 * prendre effet tout de suite, pas à l'expiration de la session — qui dure
 * quatorze jours.
 */
export async function utilisateurCourant(event: H3Event): Promise<UtilisateurConnecte | null> {
  const session = await getUserSession(event)
  const id = (session.user as { id?: number } | undefined)?.id
  if (!id) return null

  const [ligne] = await useBase()
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
 * Exige une session valide. Répond 401 sinon.
 *
 * 401 et non 403 : le client n'est pas identifié, il peut le devenir en se
 * connectant. Les deux codes ne disent pas la même chose à un navigateur.
 */
export async function exigerConnexion(event: H3Event): Promise<UtilisateurConnecte> {
  const u = await utilisateurCourant(event)
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
export async function exigerRole(event: H3Event, requis: Role): Promise<UtilisateurConnecte> {
  const u = await exigerConnexion(event)
  if (!aLeDroit(u.role, requis)) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }
  return u
}

/**
 * Trouve ou crée le compte correspondant à une adresse Google.
 *
 * LISTE BLANCHE : personne ne se crée de compte. Une adresse inconnue est
 * refusée, sauf si elle est celle du compte technique d'amorçage — le seul
 * moyen d'avoir un premier utilisateur sur une base vierge.
 */
export async function connecterOuRefuser(profil: {
  email: string
  name?: string | null
  avatarUrl?: string | null
}): Promise<UtilisateurConnecte> {
  const db = useBase()
  const email = profil.email.trim()
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
      .set({ lastLoginAt: new Date(), name: profil.name ?? existant.name })
      .where(eq(appUser.id, existant.id))
    return {
      id: existant.id,
      email: existant.email,
      name: profil.name ?? existant.name,
      avatarUrl: profil.avatarUrl ?? existant.avatarUrl,
      role: existant.role,
    }
  }

  const amorce = bootstrapTechEmail.trim()
  if (!amorce || amorce.toLowerCase() !== email.toLowerCase()) {
    throw createError({ statusCode: 403, statusMessage: 'Adresse non autorisée' })
  }

  const [cree] = await db
    .insert(appUser)
    .values({
      email,
      name: profil.name ?? null,
      avatarUrl: profil.avatarUrl ?? null,
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

  if (!cree) throw createError({ statusCode: 500, statusMessage: 'Création impossible' })
  return cree
}
