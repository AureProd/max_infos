/**
 * Date serialisation at the HTTP boundary.
 *
 * Drizzle returns `Date`s; `$fetch` carries them as ISO strings. Leaving
 * the conversion implicit would make the declared type and the value
 * actually received drift apart — and would break `frDate()`, which expects
 * `YYYY-MM-DD`. Every API date therefore goes through here explicitly.
 */

/** Full date, ISO 8601 with time zone. */
export const iso = (d: Date | null | undefined): string | null => d?.toISOString() ?? null

/**
 * Day only, `YYYY-MM-DD`, without time or zone.
 * That is what `frDate()` and the HTML `datetime` attribute expect.
 */
export const day = (d: Date | null | undefined): string | null =>
  d ? (d.toISOString().slice(0, 10) as string) : null

/**
 * Une section CDATA, qu'on ne peut pas refermer de l'intérieur.
 *
 * Elle se termine au PREMIER `]]>` rencontré : tout ce qui suit redevient
 * du XML pour le lecteur de flux. Le corps d'un article y est posé tel
 * quel, et il est aujourd'hui assaini — le `>` en ressort échappé, donc
 * rien ne passe. Mais le flux dépendait alors d'une invariante tenue
 * ailleurs, dans un autre fichier, par un autre garde-fou : c'est le genre
 * de lien que personne ne relit, et qui casse le jour où un chemin
 * d'écriture oublie de l'honorer.
 *
 * La séquence est coupée en deux sections accolées. Le texte reste
 * identique une fois recollé par le lecteur.
 */
export function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}
