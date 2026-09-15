import type { SettingKey, SettingValue } from '#shared/schemas/settings'

/** A medium referenced by a setting, already resolved to a URL server-side. */
export interface MediaPublic {
  id: number
  url: string
  alt: string | null
  mime: string
}

/**
 * What `GET /api/site` returns: the settings of public scope.
 *
 * The type is DERIVED from the schemas, not copied. Adding a public setting
 * makes it available in the browser with nothing else to write, and
 * renaming a field makes `pnpm typecheck` fail wherever it is read.
 *
 * `mediaItems` is the only entry that does not come from the settings: the
 * `…MediaId` fields carry only a number, and a page cannot display a
 * number. The server resolves them into a table indexed by id.
 */
export type SitePublic = {
  [K in SettingKey]: SettingValue<K>
} & {
  mediaItems: Record<number, MediaPublic>
}
