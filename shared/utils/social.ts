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
