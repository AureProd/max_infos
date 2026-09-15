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
