/**
 * The French labels of a social publication.
 *
 * Shared, because the back-office used to show the raw English value
 * (« reel », « image ») while the public site showed a translation: the
 * same publication had two names depending on the screen.
 */
export const MEDIA_LABELS: Record<string, string> = {
  reel: 'Reel',
  carousel: 'Carrousel',
  image: 'Photo',
  video: 'Vidéo',
  post: 'Publication',
}

export function mediaLabel(mediaType: string | null | undefined): string {
  return MEDIA_LABELS[mediaType ?? 'post'] ?? 'Publication'
}

export const NETWORK_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
}

export function networkLabel(network: string | null | undefined): string {
  return NETWORK_LABELS[network ?? ''] ?? 'Réseau'
}

/**
 * The media type a permalink reveals.
 *
 * A link pasted by hand used to be filed as « image » whatever it pointed
 * at, so a reel appeared on the home page as a still photo labelled
 * « Image » — which is exactly what it looked like on 16/09/2026.
 *
 * Returns null when the link says nothing: better an honest default than a
 * confident guess.
 */
export function mediaTypeFromUrl(url: string): 'reel' | 'image' | 'post' | null {
  if (!url) return null
  if (/instagram\.com\/reels?\//i.test(url)) return 'reel'
  if (/instagram\.com\/p\//i.test(url)) return 'image'
  if (/linkedin\.com\//i.test(url)) return 'post'
  return null
}

/**
 * Of the posts belonging to no account, the ones the home page shows.
 *
 * Both opposite failures have been met. Hand-added posts once had no
 * section at all and sat invisible in production. Then they all got one —
 * LinkedIn included, whose posts carry neither title nor image, since no
 * API will ever hand them over, and which showed up as bare plates.
 *
 * So: a loose post appears only if its network is one the site has a
 * connected account for. A LinkedIn post belongs on the article it
 * illustrates, not on the front page.
 */
export function postsWorthShowing<T extends { network: string }>(
  posts: readonly T[],
  networksConnected: readonly string[],
): T[] {
  const open = new Set(networksConnected)
  return posts.filter((p) => open.has(p.network))
}
