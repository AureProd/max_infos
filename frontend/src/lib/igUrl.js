/**
 * Extrait l'identifiant d'une publication depuis une adresse Instagram.
 * Accepte /p/, /reel/, /reels/ et /tv/, avec ou sans paramètres.
 */
export function parseInstagramUrl(input) {
  const s = String(input || '').trim()
  if (!s) return null
  const m = s.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/)
  if (m) return { kind: m[1] === 'p' ? 'p' : 'reel', shortcode: m[2] }
  // un identifiant collé seul
  if (/^[A-Za-z0-9_-]{5,}$/.test(s)) return { kind: 'p', shortcode: s }
  return null
}
