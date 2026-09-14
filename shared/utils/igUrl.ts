export type InstagramKind = 'p' | 'reel'

export interface InstagramRef {
  kind: InstagramKind
  shortcode: string
}

/**
 * Extrait l'identifiant d'une publication depuis une adresse Instagram.
 * Accepte /p/, /reel/, /reels/ et /tv/, avec ou sans paramètres.
 *
 * Partagé entre le formulaire de l'admin et sa validation côté serveur :
 * les deux doivent accepter exactement la même chose.
 */
export function parseInstagramUrl(input: unknown): InstagramRef | null {
  const s = String(input ?? '').trim()
  if (!s) return null
  const m = s.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/)
  if (m?.[2]) return { kind: m[1] === 'p' ? 'p' : 'reel', shortcode: m[2] }
  // Un identifiant collé seul.
  if (/^[A-Za-z0-9_-]{5,}$/.test(s)) return { kind: 'p', shortcode: s }
  return null
}
