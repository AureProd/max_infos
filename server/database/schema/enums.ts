import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Les valeurs fermées du modèle de données.
 *
 * Choix assumé : colonne `text` + contrainte CHECK, et non `pgEnum`.
 *
 *  1. Migration. `ALTER TYPE … ADD VALUE` ne s'exécute pas dans une
 *     transaction sous PostgreSQL, or une migration drizzle-kit est un
 *     fichier SQL joué en bloc. Et retirer une valeur impose de recréer le
 *     type puis de réécrire toutes les colonnes qui l'utilisent. Or ces
 *     listes vont bouger : `media_type` gagnera « story », `source`
 *     gagnera d'autres provenances.
 *  2. Source de vérité unique. Un tuple TypeScript `as const` alimente à la
 *     fois le type TS, la contrainte CHECK et le schéma Zod. Avec pgEnum il
 *     faudrait resynchroniser Zod à la main.
 *  3. Le coût est nul : un CHECK … IN (…) est aussi rapide qu'un enum.
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

// Réexporté depuis shared/ : la contrainte SQL et la règle d'autorisation
// doivent décrire exactement le même ensemble. Import relatif et non
// `#shared`, parce que ce fichier est aussi lu par le script de semis, qui
// tourne sous tsx et ne connaît pas les alias de Nuxt.
export { ROLES as USER_ROLE, type Role as UserRole } from '../../../shared/utils/roles'

/**
 * Fabrique l'expression `colonne in ('a', 'b')` d'une contrainte CHECK à
 * partir du tuple de valeurs, pour qu'il n'y ait jamais qu'un seul endroit
 * à modifier.
 */
export function uneValeurParmi(colonne: AnyPgColumn, valeurs: readonly string[]) {
  // sql.raw et non une interpolation : Drizzle transforme `${v}` en
  // PARAMÈTRE LIÉ ($1, $2…), ce qui n'a aucun sens dans du DDL — la
  // contrainte générée serait `in ($1, $2)` et donc inopérante.
  // Les valeurs viennent de nos propres tuples `as const`, jamais d'une
  // saisie ; l'apostrophe est malgré tout échappée.
  // TRIÉ : sans cela, l'ordre du tuple TypeScript fuirait dans le SQL, et
  // le moindre réordonnancement — qui ne change rien au sens — produirait
  // une migration. Le tri rend la contrainte générée déterministe.
  const liste = [...valeurs]
    .sort()
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(', ')
  return sql`${colonne} in (${sql.raw(liste)})`
}
