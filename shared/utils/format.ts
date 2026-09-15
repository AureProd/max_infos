// Displayed to visitors: these month names are site content, so they stay
// in French.
const MONTHS = [
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
 * Noon, not midnight: a bare date read as midnight UTC falls back to the
 * previous day in western time zones, and the server render does not share
 * the browser's zone.
 */
const parse = (iso: string): Date => new Date(`${iso}T12:00:00`)

export const frDate = (iso: string): string => {
  const d = parse(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export const frShort = (iso: string): string => {
  const d = parse(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 4)}.`
}

/**
 * Narrow no-break space (U+202F), the thousands separator in French
 * typography. Written as an escape on purpose: as a literal character it is
 * invisible, and any editor pass can silently turn it into a plain space.
 */
const NARROW_NO_BREAK_SPACE = '\u202f'

/**
 * Groups thousands the French way.
 *
 * Written by hand, WITHOUT `Intl`. `toLocaleString('fr-FR')` yields U+202F
 * or U+00A0 depending on the bundled ICU version: server and browser would
 * then not render the same byte, and Vue would report a hydration mismatch
 * on every number shown. The same trap awaits `toLocaleDateString`, hence
 * the month table above.
 */
export const nb = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NO_BREAK_SPACE)

/**
 * Counts the characters of a text, with whitespace normalised.
 *
 * `\s` covers U+00A0 and U+202F in JavaScript: the no-break spaces of
 * French typography are therefore treated like any other, which is the
 * intended behaviour.
 */
export const countChars = (text: string): number => text.replace(/\s+/g, ' ').length
