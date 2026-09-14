const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

/**
 * Midi, et non minuit : une date nue interprétée à minuit UTC bascule la
 * veille dans les fuseaux à l'ouest, et le rendu serveur n'a pas le même
 * fuseau que le navigateur.
 */
const parse = (iso: string): Date => new Date(`${iso}T12:00:00`)

export const frDate = (iso: string): string => {
  const d = parse(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

export const frShort = (iso: string): string => {
  const d = parse(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]?.slice(0, 4)}.`
}

/** Espace fine insécable, séparateur des milliers en typographie française. */
const FINE_INSECABLE = ' '

/**
 * Groupe les milliers à la française.
 *
 * Écrit à la main, SANS `Intl`. `toLocaleString('fr-FR')` produit U+202F ou
 * U+00A0 selon la version d'ICU embarquée : le serveur et le navigateur ne
 * rendraient alors pas le même octet, et Vue signalerait un écart
 * d'hydratation sur chaque nombre affiché. Le même piège guette
 * `toLocaleDateString`, d'où la table de mois ci-dessus.
 */
export const nb = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, FINE_INSECABLE)

/**
 * Compte les caractères d'un texte, espaces normalisées.
 *
 * `\s` inclut U+00A0 et U+202F en JavaScript : les espaces insécables de la
 * typographie française sont donc traitées comme les autres, ce qui est le
 * comportement voulu.
 */
export const countChars = (text: string): number => text.replace(/\s+/g, ' ').length
