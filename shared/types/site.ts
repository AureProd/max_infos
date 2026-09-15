import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/** Un média référencé par un réglage, déjà résolu en URL par le serveur. */
export interface MediaPublic {
  id: number
  url: string
  alt: string | null
  mime: string
}

/**
 * Ce que renvoie `GET /api/site` : les réglages de portée publique.
 *
 * Le type est DÉDUIT des schémas, il n'est pas recopié. Ajouter un réglage
 * public le rend disponible côté navigateur sans rien écrire de plus, et
 * renommer un champ fait échouer `pnpm typecheck` là où il est lu.
 *
 * `mediaItems` est la seule entrée qui ne vienne pas des réglages : les fields
 * `…MediaId` ne portent qu'un nombre, et une page ne sait pas afficher un
 * nombre. Le serveur les résout en une table indexée par identifiant.
 */
export type SitePublic = {
  [K in SettingKey]: SettingValue<K>
} & {
  mediaItems: Record<number, MediaPublic>
}
