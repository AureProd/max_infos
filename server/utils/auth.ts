import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { asRole, isAllowed, type Role } from '#shared/utils/roles'
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
 * The session user, or null.
 *
 * Re-reads the role FROM THE DATABASE on every request rather than trusting
 * the one sealed in the cookie: removing a role or disabling an account
 * must take effect straight away, not when the session expires — which
 * takes fourteen days.
 */
export async function currentUser(event: H3Event): Promise<SignedInUser | null> {
  const session = await getUserSession(event)
  const id = (session.user as { id?: number } | undefined)?.id
  if (!id) return null

  const [row] = await useDatabase()
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

  if (!row || !row.active) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    // `asRole` and not `row.role`: the column may still hold `tech`, the
    // former name of `developer`, for the length of a deployment. Reading
    // it here means nothing downstream ever has to know that.
    role: asRole(row.role),
  }
}

/**
 * Requires a valid session. Answers 401 otherwise.
 *
 * 401 and not 403: the client is not identified, and can become so by
 * signing in. The two codes do not say the same thing to a browser.
 */
export async function requireSignIn(event: H3Event): Promise<SignedInUser> {
  const u = await currentUser(event)
  if (!u) throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
  return u
}

/**
 * Requires a role at least equal to the one asked for. Answers 403
 * otherwise.
 *
 * This is THE function of the project not to bypass: every `/api/admin/*`
 * route goes through it. The parameterised test in
 * test/api/authorization.spec.ts checks that none escapes it.
 */
export async function requireRole(event: H3Event, required: Role): Promise<SignedInUser> {
  const u = await requireSignIn(event)
  if (!isAllowed(u.role, required)) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }
  return u
}

/**
 * Finds or creates the account matching a Google address.
 *
 * ALLOW LIST: nobody signs themselves up. An unknown address is refused,
 * unless it is the bootstrap technical account's — the only way to get a
 * first user on a blank database.
 */
export async function signInOrReject(profile: {
  email: string
  name?: string | null
  avatarUrl?: string | null
}): Promise<SignedInUser> {
  const db = useDatabase()
  const email = profile.email.trim()
  const { bootstrapTechEmail } = useRuntimeConfig()

  // Case-insensitive comparison: Google returns the address with varying
  // case, and the table's unique index is on lower(email) too.
  const [existing] = await db
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

  if (existing) {
    if (!existing.active) {
      throw createError({ statusCode: 403, statusMessage: 'Compte désactivé' })
    }
    await db
      .update(appUser)
      .set({ lastLoginAt: new Date(), name: profile.name ?? existing.name })
      .where(eq(appUser.id, existing.id))
    return {
      id: existing.id,
      email: existing.email,
      name: profile.name ?? existing.name,
      avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
      role: asRole(existing.role),
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
      role: 'developer',
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
  return { ...created, role: asRole(created.role) }
}
