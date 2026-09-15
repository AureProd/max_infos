export interface InstagramRef {
  kind: 'p' | 'reel'
  shortcode: string
}

/**
 * Extracts a post identifier from an Instagram address.
 * Accepts /p/, /reel/, /reels/ and /tv/, with or without parameters.
 */
export function parseInstagramUrl(entry: unknown): InstagramRef | null {
  const s = String(entry ?? '').trim()
  if (!s) return null
  const m = s.match(/instagram\.com\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/)
  if (m?.[2]) return { kind: m[1] === 'p' ? 'p' : 'reel', shortcode: m[2] }
  if (/^[A-Za-z0-9_-]{5,}$/.test(s)) return { kind: 'p', shortcode: s }
  return null
}
