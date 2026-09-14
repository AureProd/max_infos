/**
 * Types du contenu d'origine, lu par le script de semis.
 *
 * Ils ne décrivent QUE ce que le script de migration consomme. Le reste du
 * code se sert des types que Drizzle déduit du schéma, ou de ceux que Nitro
 * infère des handlers.
 */

export interface Article {
  id: string
  title: string
  dek: string
  /** Date ISO nue, sans heure : `2026-09-11`. */
  date: string
  minutes: number
  chars: number
  tags: string[]
  cover: string
  substack: string
  body: string
}

export interface IgMedia {
  id: string
  type: 'reel' | 'carousel'
  kind: 'p' | 'reel'
  shortcode: string
  url: string
  articleId: string
  date: string
}
