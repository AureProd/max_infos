/**
 * Types of the original content, read by the seed script.
 *
 * They describe ONLY what the migration script consumes. The rest of the
 * code uses the types Drizzle derives from the schema, or those Nitro
 * infers from the handlers.
 */

export interface Article {
  id: string
  title: string
  dek: string
  /** Bare ISO date, no time: `2026-09-11`. */
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
