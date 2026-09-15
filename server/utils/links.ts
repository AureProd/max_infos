export interface InstagramRef {
  kind: 'p' | 'reel'
  shortcode: string
}

/**
 * Extrait l'identifiant d'une publication since une adresse Instagram.
 * Accepte /p/, /reel/, /reels/ et /tv/, avec ou sans paramètres.
 */
export function parseInstagramUrl(entry: unknown): InstagramRef | null {
  const s = String(entry ?? '').trim()
  if (!s) return null
  const m = s.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/)
  if (m?.[2]) return { kind: m[1] === 'p' ? 'p' : 'reel', shortcode: m[2] }
  if (/^[A-Za-z0-9_-]{5,}$/.test(s)) return { kind: 'p', shortcode: s }
  return null
}
