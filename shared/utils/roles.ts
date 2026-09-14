/**
 * Les deux rôles du projet, et ce qu'ils autorisent.
 *
 * Ils vivent dans shared/ parce que la règle doit être la MÊME des deux
 * côtés : le serveur refuse, et le navigateur masque. Deux implémentations
 * finiraient par diverger, et c'est toujours celle du serveur qu'on
 * oublierait.
 *
 * Le masquage côté navigateur n'est PAS une sécurité : c'est du confort,
 * pour que Max ne voie pas des écrans qui ne le concernent pas. La sécurité
 * est le refus côté serveur, et elle seule.
 */

/** Par pouvoir croissant. L'ordre porte la règle : voir aLeDroit(). */
export const ROLES = ['editor', 'tech'] as const
export type Role = (typeof ROLES)[number]

/**
 * `tech` peut tout ce que peut `editor`, et davantage.
 *
 * JB est `tech` : il gère l'infrastructure, les comptes tiers et les clés.
 * Max est `editor` : il écrit et règle le site, et ne doit JAMAIS voir un
 * champ technique.
 */
export function aLeDroit(role: Role | null | undefined, requis: Role): boolean {
  if (!role) return false
  return ROLES.indexOf(role) >= ROLES.indexOf(requis)
}

export const estRole = (v: unknown): v is Role => ROLES.includes(v as Role)
