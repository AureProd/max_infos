import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/**
 * Ce que renvoie `GET /api/site` : les réglages de portée publique.
 *
 * Le type est DÉDUIT des schémas, il n'est pas recopié. Ajouter un réglage
 * public le rend disponible côté navigateur sans rien écrire de plus, et
 * renommer un champ fait échouer `pnpm typecheck` là où il est lu.
 */
export type SitePublic = {
  [K in SettingKey]: SettingValue<K>
}
