/**
 * What the server was willing to say — never an empty string.
 *
 * Ten screens used to extract this on their own, and nine of them read
 * `statusMessage` alone. Behind Traefik in HTTP/2 that field arrives empty
 * — ofetch derives it from `statusText`, which HTTP/2 does not carry (see
 * the comment in `SubstackPanel.vue`). A refused save therefore showed a
 * blank error, and Max only saw a form that would not stick.
 *
 * `??` alone is not enough either: ofetch fills `data.message` with '' rather
 * than leaving it out, and an empty reason displays as NO reason — the very
 * silence this function exists to break.
 */
export function reason(e: unknown, fallback = 'Une erreur est survenue'): string {
  if (typeof e === 'string' && e.trim() !== '') return e

  const err = (e ?? {}) as {
    statusMessage?: string
    data?: { message?: string }
    message?: string
  }

  const said = [err.data?.message, err.statusMessage, err.message].find(
    (s) => typeof s === 'string' && s.trim() !== '',
  )

  return said ?? fallback
}
