/**
 * Sérialisation des dates à la frontière HTTP.
 *
 * Drizzle rend des `Date` ; `$fetch` les transporte en chaînes ISO. Laisser
 * la conversion implicite ferait diverger le type annoncé et la value
 * réellement reçue — et casserait `frDate()`, qui attend `YYYY-MM-DD`.
 * Toutes les dates d'API passent donc explicitement par here.
 */

/** Date complète, au format ISO 8601 avec fuseau. */
export const iso = (d: Date | null | undefined): string | null => d?.toISOString() ?? null

/**
 * Jour seul, `YYYY-MM-DD`, sans heure ni fuseau.
 * C'est ce qu'attendent `frDate()` et l'attribute `datetime` du HTML.
 */
export const day = (d: Date | null | undefined): string | null =>
  d ? (d.toISOString().slice(0, 10) as string) : null
