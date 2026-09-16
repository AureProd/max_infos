import { type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Accent- and case-insensitive text search.
 *
 * ILIKE folds case but NOT diacritics: on a French site, « Algerie » found
 * nothing while « Algérie » found two articles — and the slugs of this very
 * project are stripped of accents, so typing without them is the natural
 * habit of the visitor.
 *
 * `translate` rather than the `unaccent` extension: CREATE EXTENSION needs
 * rights the application's database user does not have, and must not have.
 * The mapping covers French plus the neighbouring languages likely to
 * appear in a byline.
 */
// Both strings must have the same length, or `translate` would silently
// delete characters. Kept honest by test/unit/search.spec.ts.
export const ACCENT_MAP = {
  from: 'àáâãäåçćèéêëìíîïñòóôõöøùúûüýÿšž',
  to: 'aaaaaacceeeeiiiinoooooouuuuyysz',
}

/** The same folding as the SQL side, applied to what the visitor typed. */
export function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Escapes what LIKE treats as a wildcard.
 *
 * Without this, `q=%` matched every article and presented them as search
 * results. There was no SQL injection — Drizzle binds the value — but the
 * answer was wrong, which is bad enough.
 */
export function escapeLike(text: string): string {
  return text.replace(/([\\%_])/g, '\\$1')
}

/** The pattern to compare against, from the visitor's raw input. */
export function likePattern(q: string): string {
  return `%${escapeLike(foldAccents(q))}%`
}

/** `column`, lower-cased and stripped of its accents, for comparison. */
export function folded(column: AnyPgColumn): SQL<string> {
  return sql<string>`translate(lower(${column}), ${ACCENT_MAP.from}, ${ACCENT_MAP.to})`
}
