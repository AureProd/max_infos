/**
 * Formes possibles d'une diapositive de carrousel.
 *
 * Elles vivent dans shared/ et non dans app/ parce que les DONNÉES qui les
 * portent y vivent aussi, et qu'elles alimenteront au lot 7 les gabarits de
 * déclinaison, côté serveur. Seul le dessin SVG reste dans app/utils/.
 *
 * Quatre formes aux champs DISJOINTS : l'union discriminée sur `type` fait
 * vérifier par le compilateur qu'on ne lit pas `figure` sur une citation.
 */

export interface SlideCover {
  type: 'cover'
  title: string
  kicker?: string
  alt?: string
}

export interface SlideStat {
  type: 'stat'
  figure: string
  label: string
  source?: string
  alt?: string
}

export interface SlideQuote {
  type: 'quote'
  text: string
  attribution?: string
  alt?: string
}

export interface SlideOutro {
  type: 'outro'
  title: string
  body: string
  cta?: string
  alt?: string
}

export type SlideSpec = SlideCover | SlideStat | SlideQuote | SlideOutro
