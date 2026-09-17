/**
 * The project's two roles, and what they allow.
 *
 * They live in shared/ because the rule must be the SAME on both sides: the
 * server refuses, the browser hides. Two implementations would drift apart
 * eventually, and it is always the server one that would be forgotten.
 *
 * Hiding things in the browser is NOT a security measure: it is comfort, so
 * that Max is not shown screens that do not concern him. Security is the
 * refusal on the server, and nothing else.
 */

/** By increasing power. The order carries the rule: see isAllowed(). */
export const ROLES = ['editor', 'developer'] as const
export type Role = (typeof ROLES)[number]

/**
 * The former name of `developer`, still written in the database.
 *
 * A migration renames the rows, but not at the same instant as the
 * deployment: the OLD container keeps serving while the new schema is
 * applied, and it writes `tech`. So the constraint must keep accepting the
 * word, and reading it must keep granting what it granted — otherwise JB
 * loses access to his own back-office for the length of a deployment.
 *
 * Removed by a LATER migration, once no container writes it any more.
 */
export const LEGACY_ROLE = 'tech'

/** What the `app_user.role` column is allowed to contain, today. */
export const STORED_ROLES = [...ROLES, LEGACY_ROLE] as const

/**
 * `developer` can do everything `editor` can, and more.
 *
 * JB is `developer`: he runs the infrastructure, the third-party accounts
 * and the keys. Max is `editor`: he writes and configures the site, and
 * must NEVER see a technical field.
 */
export function isAllowed(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false
  return ROLES.indexOf(role) >= ROLES.indexOf(required)
}

export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role)

/**
 * What a stored value MEANS, so that nothing downstream has to know the
 * old name.
 *
 * An unrecognised value falls back to the LEAST powerful role. A row
 * written by hand, or one left by a version that was rolled back, must cost
 * a refusal — never a permission.
 */
export function asRole(stored: unknown): Role {
  if (stored === LEGACY_ROLE) return 'developer'
  return isRole(stored) ? stored : 'editor'
}
