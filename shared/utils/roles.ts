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
export const ROLES = ['editor', 'tech'] as const
export type Role = (typeof ROLES)[number]

/**
 * `tech` can do everything `editor` can, and more.
 *
 * JB is `tech`: he runs the infrastructure, the third-party accounts and
 * the keys. Max is `editor`: he writes and configures the site, and must
 * NEVER see a technical field.
 */
export function isAllowed(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false
  return ROLES.indexOf(role) >= ROLES.indexOf(required)
}

export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role)
