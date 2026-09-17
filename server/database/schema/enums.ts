import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * The closed value sets of the data model.
 *
 * A deliberate choice: a `text` column plus a CHECK constraint, not
 * `pgEnum`.
 *
 *  1. Migrations. `ALTER TYPE … ADD VALUE` does not run inside a
 *     transaction under PostgreSQL, and a drizzle-kit migration is one SQL
 *     file played as a block. Removing a value also means recreating the
 *     type then rewriting every column using it. And these lists will move:
 *     `media_type` will gain « story », `source` will gain other origins.
 *  2. A single source of truth. One TypeScript `as const` tuple feeds the
 *     TS type, the CHECK constraint and the Zod schema at once. With pgEnum
 *     Zod would have to be resynchronised by hand.
 *  3. The cost is nil: a CHECK … IN (…) is as fast as an enum.
 */

export const ARTICLE_STATUS = ['draft', 'published'] as const
export type ArticleStatus = (typeof ARTICLE_STATUS)[number]

export const ARTICLE_SOURCE = ['site', 'substack_import'] as const
export type ArticleSource = (typeof ARTICLE_SOURCE)[number]

export const MEDIA_KIND = ['image', 'pdf'] as const
export type MediaKind = (typeof MEDIA_KIND)[number]

export const SOCIAL_NETWORK = ['instagram', 'linkedin'] as const
export type SocialNetwork = (typeof SOCIAL_NETWORK)[number]

export const SOCIAL_MEDIA_TYPE = ['reel', 'carousel', 'image', 'post'] as const
export type SocialMediaType = (typeof SOCIAL_MEDIA_TYPE)[number]

export const SOCIAL_SOURCE = ['api', 'manual'] as const
export type SocialSource = (typeof SOCIAL_SOURCE)[number]

export const SETTING_SCOPE = ['public', 'tech'] as const
export type SettingScope = (typeof SETTING_SCOPE)[number]

// Re-exported from shared/: the SQL constraint and the authorization rule
// must describe exactly the same set. A relative import rather than
// `#shared`, because this file is also read by the seed script, which runs
// under tsx and knows nothing of Nuxt's aliases.
//
// The CHECK is built from STORED_ROLES, not ROLES: it must still accept
// `tech`, the former name of `developer`, for the length of one deployment
// — the old container keeps writing it while the new schema is applied.
export {
  asRole,
  type Role as UserRole,
  STORED_ROLES as USER_ROLE,
} from '../../../shared/utils/roles'

/**
 * Builds the `column in ('a', 'b')` expression of a CHECK constraint from
 * the value tuple, so that there is only ever one place to edit.
 */
export function oneOf(column: AnyPgColumn, values: readonly string[]) {
  // sql.raw and not an interpolation: Drizzle turns `${v}` into a BOUND
  // PARAMETER ($1, $2…), which makes no sense in DDL — the generated
  // constraint would read `in ($1, $2)` and do nothing.
  // The values come from our own `as const` tuples, never from user input;
  // the apostrophe is escaped all the same.
  // SORTED: without that, the order of the TypeScript tuple would leak into
  // the SQL, and the slightest reordering — which changes no meaning —
  // would produce a migration. Sorting makes the generated constraint
  // deterministic.
  const list = [...values]
    .sort()
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(', ')
  return sql`${column} in (${sql.raw(list)})`
}
