/**
 * Types du contenu de la maquette.
 *
 * TEMPORAIRE : au lot 3 ces données passent en base et ces types sont
 * remplacés par ceux que Drizzle déduit du schéma — c'est tout l'intérêt de
 * la bascule. Ils sont écrits à la main en attendant, pour que les
 * composants soient convertis une seule fois.
 */

export type Ratio = '3 / 2' | '1 / 1' | '4 / 5'

export interface Article {
  id: string
  title: string
  dek: string
  /** Date ISO nue, sans heure : `2026-09-11`. */
  date: string
  minutes: number
  chars: number
  tags: string[]
  ratio: Ratio
  cover: string
  substack: string
  body: string
}

export type Network = 'instagram' | 'linkedin'

interface PostCommun {
  id: string
  network: Network
  articleId: string
  date: string
  /** Marque une entrée de maquette, à remplacer par une vraie publication. */
  placeholder?: boolean
}

export interface InstagramPost extends PostCommun {
  network: 'instagram'
  caption: string
  seed: number
  likes: number | null
  comments: number | null
}

export interface LinkedinPost extends PostCommun {
  network: 'linkedin'
  text: string
}

export type Post = InstagramPost | LinkedinPost

export interface IgMedia {
  id: string
  type: 'reel' | 'carousel'
  kind: 'p' | 'reel'
  shortcode: string
  url: string
  articleId: string
  date: string
}
