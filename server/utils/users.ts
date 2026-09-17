import { and, eq, inArray, ne } from 'drizzle-orm'
import { asRole, LEGACY_ROLE, type Role } from '#shared/utils/roles'
import { useDatabase } from '~~/server/database/client'
import { appUser } from '~~/server/database/schema'

/**
 * The accounts allowed to sign in.
 *
 * Google AUTHENTICATES; this list AUTHORISES. Inviting therefore means
 * writing the row ahead of time: `signInOrReject` matches on lower(email)
 * and fills the name in on the first connection. There is no invitation
 * token, no pending state, no second table — a row is enough.
 *
 * The rules live here rather than in the route handlers: they are the
 * security of the feature, and this way they are exercised by tests that run
 * inside the vitest process, against a real database.
 */

/** What an account shows. Never `avatarUrl`, which the screen does not use. */
const FIELDS = {
  id: appUser.id,
  email: appUser.email,
  name: appUser.name,
  role: appUser.role,
  active: appUser.active,
  lastLoginAt: appUser.lastLoginAt,
}

export interface AccountChange {
  role?: Role
  active?: boolean
}

/**
 * The two spellings of the developer role that the column may hold.
 *
 * `tech` is its former name, still legal for the length of one deployment.
 * A query that looked for `developer` alone would conclude there is no
 * developer left and refuse every change — including, ironically, the one
 * that would fix it.
 */
const DEVELOPER_IN_DB = ['developer', LEGACY_ROLE] as const

async function load(id: number) {
  const [row] = await useDatabase().select(FIELDS).from(appUser).where(eq(appUser.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  // Normalised here, once: everything downstream — the rules below and the
  // JSON the screen receives — then speaks a single name.
  return { ...row, role: asRole(row.role) }
}

/**
 * Refuses to let someone cut their own access.
 *
 * THE rule that prevents a lockout. On a site with two accounts, one careless
 * click would mean getting back in through NUXT_BOOTSTRAP_TECH_EMAIL, on the
 * VPS. Changing something harmless about yourself stays allowed: the rule is
 * about ACCESS, not about the row.
 */
function refuseSelfHarm(actorId: number, target: { id: number; role: Role }, c: AccountChange) {
  if (actorId !== target.id) return
  if (c.active === false || (c.role !== undefined && c.role !== target.role)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'On ne peut pas retirer son propre accès',
    })
  }
}

/**
 * Refuses to strip the last active `developer`.
 *
 * Belt and braces: `refuseSelfHarm` already makes a lockout unreachable
 * through the routes, since the last developer is necessarily the one asking. This
 * one holds even for a caller that forgets to pass the actor — a script, a
 * route written later.
 *
 * A DEACTIVATED developer does not count: an account that can no longer sign in
 * protects nothing.
 */
async function refuseLosingLastDeveloper(
  target: { id: number; role: Role; active: boolean },
  c: AccountChange & { removed?: boolean },
) {
  if (target.role !== 'developer' || !target.active) return
  const losing = c.removed || c.active === false || (c.role !== undefined && c.role !== 'developer')
  if (!losing) return

  const [survivor] = await useDatabase()
    .select({ id: appUser.id })
    .from(appUser)
    .where(
      and(
        inArray(appUser.role, [...DEVELOPER_IN_DB]),
        eq(appUser.active, true),
        ne(appUser.id, target.id),
      ),
    )
    .limit(1)

  if (!survivor) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Il doit rester au moins un compte développeur actif',
    })
  }
}

/** Invites an address. Inviting is writing the row a first login will find. */
export async function inviteUser(email: string, role: Role) {
  const [row] = await useDatabase()
    .insert(appUser)
    .values({ email: email.trim(), role })
    // No `target`: the unique index `uq_app_user_email` is on an EXPRESSION,
    // lower(email), and drizzle types `target` as a column — aiming at it
    // would not even compile, and `appUser.email` carries no constraint of
    // its own, so it would fail at runtime only. A bare DO NOTHING covers
    // every unique index of the table, in ONE statement: two simultaneous
    // invitations of the same address cannot both win.
    //
    // It also swallows any OTHER unique constraint. `app_user` has none
    // today beyond the key and the address; the day it gains one, the
    // message below becomes a lie.
    .onConflictDoNothing()
    .returning(FIELDS)

  if (!row) {
    throw createError({ statusCode: 409, statusMessage: 'Cette adresse est déjà invitée' })
  }
  return { ...row, role: asRole(row.role) }
}

/** Changes a role, an access, or both. */
export async function changeUser(actorId: number, id: number, changes: AccountChange) {
  const target = await load(id)

  refuseSelfHarm(actorId, target, changes)
  await refuseLosingLastDeveloper(target, changes)

  // Nothing to write: the screen sends the field it touched, and an empty
  // change is not an error — it is a click that changed nothing.
  if (changes.role === undefined && changes.active === undefined) return target

  const [row] = await useDatabase()
    .update(appUser)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(appUser.id, id))
    .returning(FIELDS)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return { ...row, role: asRole(row.role) }
}

/**
 * Deletes an account.
 *
 * `media.uploaded_by` and `setting.updated_by` are ON DELETE SET NULL: the
 * media and settings the account touched survive, they simply lose their
 * signature.
 */
export async function removeUser(actorId: number, id: number) {
  const target = await load(id)

  if (actorId === target.id) {
    throw createError({
      statusCode: 409,
      statusMessage: 'On ne peut pas supprimer son propre compte',
    })
  }
  await refuseLosingLastDeveloper(target, { removed: true })

  const [row] = await useDatabase()
    .delete(appUser)
    .where(eq(appUser.id, id))
    .returning({ id: appUser.id })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  return row
}
