import type { SlideSpec } from '#shared/types/slide'

export type { SlideSpec } from '#shared/types/slide'

/**
 * Diapositives de carrousel dessinées en SVG, au format carré Instagram.
 * Le texte est du vrai texte (pas une image) : il reste net à toute taille
 * et lisible par les lecteurs d'écran via l'attribut aria-label.
 *
 * Le typage de `spec` est le seul non trivial de la conversion : quatre
 * formes aux champs DISJOINTS. En JavaScript, la suite de `else if`
 * suffisait ; en TypeScript, une union discriminée sur `type` fait vérifier
 * par le compilateur qu'on ne lit pas `figure` sur une diapositive de
 * citation. Ce sont ces données qui alimenteront les gabarits de
 * déclinaison du lot 7 : les typer les rend vérifiables.
 */

export interface Slide {
  viewBox: string
  inner: string
  label: string
}

interface BlocOptions {
  x: number
  y: number
  size: number
  lead: number
  weight: number
  fill: string
  family: string
}

const PALETTE = {
  ink: '#1E2127',
  surface: '#1E2127',
  accent: '#4A81F5',
  accentDeep: '#2462E9',
  gold: '#E9AB24',
  text: '#DBDEE1',
  muted: '#949BA4',
}

/** Découpe un texte en lignes d'au plus `perLine` caractères, sans couper les mots. */
function wrap(text: string, perLine: number): string[] {
  const words = String(text).split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= perLine) line += ' ' + w
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

const esc = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function block(lines: string[], { x, y, size, lead, weight, fill, family }: BlocOptions): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * lead}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="-0.5">${esc(l)}</text>`,
    )
    .join('')
}

const DISPLAY = 'Bricolage Grotesque, Helvetica Neue, Arial, sans-serif'
const BODY = 'Newsreader, Georgia, serif'

/** Le texte lu par les lecteurs d'écran, selon la forme de la diapositive. */
function etiquette(spec: SlideSpec): string {
  if (spec.alt) return spec.alt
  switch (spec.type) {
    case 'cover':
    case 'outro':
      return spec.title
    case 'stat':
      return spec.label
    case 'quote':
      return spec.text
  }
}

export function slide(spec: SlideSpec, handle = '@unmaxdinfo_'): Slide {
  const S = 1080
  const P = 88
  const parts = [`<rect width="${S}" height="${S}" fill="${PALETTE.ink}"/>`]

  if (spec.type === 'cover') {
    const lines = wrap(spec.title, 15)
    const size = lines.length > 3 ? 82 : 96
    parts.push(`<rect x="${P}" y="${P}" width="72" height="8" fill="${PALETTE.accent}"/>`)
    parts.push(
      block(lines, {
        x: P,
        y: P + 150,
        size,
        lead: size * 1.02,
        weight: 700,
        fill: PALETTE.text,
        family: DISPLAY,
      }),
    )
    if (spec.kicker) {
      parts.push(
        `<text x="${P}" y="${S - P - 42}" font-family="${DISPLAY}" font-size="30" font-weight="500" fill="${PALETTE.muted}">${esc(spec.kicker)}</text>`,
      )
    }
    parts.push(
      `<text x="${P}" y="${S - P}" font-family="${DISPLAY}" font-size="30" font-weight="600" fill="${PALETTE.accent}">${esc(handle)}</text>`,
    )
  } else if (spec.type === 'stat') {
    parts.push(
      `<text x="${P}" y="${P + 290}" font-family="${DISPLAY}" font-size="186" font-weight="700" fill="${PALETTE.gold}" letter-spacing="-6">${esc(spec.figure)}</text>`,
    )
    parts.push(
      block(wrap(spec.label, 26), {
        x: P,
        y: P + 400,
        size: 44,
        lead: 60,
        weight: 500,
        fill: PALETTE.text,
        family: DISPLAY,
      }),
    )
    if (spec.source) {
      parts.push(
        `<text x="${P}" y="${S - P}" font-family="${DISPLAY}" font-size="26" font-weight="400" fill="${PALETTE.muted}">${esc(spec.source)}</text>`,
      )
    }
  } else if (spec.type === 'quote') {
    parts.push(`<rect x="${P}" y="${P + 60}" width="5" height="420" fill="${PALETTE.accent}"/>`)
    parts.push(
      block(wrap(spec.text, 24), {
        x: P + 44,
        y: P + 150,
        size: 54,
        lead: 76,
        weight: 400,
        fill: PALETTE.text,
        family: BODY,
      }),
    )
    if (spec.attribution) {
      parts.push(
        `<text x="${P + 44}" y="${S - P}" font-family="${DISPLAY}" font-size="28" font-weight="500" fill="${PALETTE.muted}">${esc(spec.attribution)}</text>`,
      )
    }
  } else if (spec.type === 'outro') {
    parts.push(
      block(wrap(spec.title, 17), {
        x: P,
        y: P + 210,
        size: 76,
        lead: 86,
        weight: 700,
        fill: PALETTE.text,
        family: DISPLAY,
      }),
    )
    parts.push(
      block(wrap(spec.body, 30), {
        x: P,
        y: P + 470,
        size: 38,
        lead: 54,
        weight: 400,
        fill: PALETTE.muted,
        family: DISPLAY,
      }),
    )
    parts.push(
      `<rect x="${P}" y="${S - P - 96}" width="430" height="76" fill="${PALETTE.accent}"/>`,
    )
    parts.push(
      `<text x="${P + 34}" y="${S - P - 44}" font-family="${DISPLAY}" font-size="32" font-weight="700" fill="${PALETTE.ink}">${esc(spec.cta || 'Lire l’article')}</text>`,
    )
  }

  return {
    viewBox: `0 0 ${S} ${S}`,
    inner: parts.join(''),
    // Chaque forme a son propre champ porteur de sens : la lecture est
    // désormais vérifiée par le compilateur au lieu d'être devinée.
    label: etiquette(spec),
  }
}
