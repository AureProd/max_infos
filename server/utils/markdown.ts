import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * The reference Markdown rendering, run SERVER-SIDE at save time, never on
 * read.
 *
 * Three consequences, and they are the whole point:
 *  - displaying an article no longer costs any rendering;
 *  - the HTML served is sanitised BY CONSTRUCTION, not because someone
 *    remembered to do it at every place that displays it;
 *  - the back-office preview goes through the same function, so it cannot
 *    drift from the published rendering.
 *
 * Replaces the mock-up's home-grown engine, dropped in lot 5: it wrote
 * href="..." without checking anything, and rendered on display.
 */

const engine = new Marked({
  gfm: true,
  breaks: false,
})

/**
 * The allow list. Anything not in it is stripped — including the tags
 * `marked` can produce but that we do not want in an article (`<script>`,
 * `<iframe>`, `<form>`, `<style>`).
 */
const RULES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h2',
    'h3',
    'h4',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    // target and rel must be listed here: transformTags adds them, but
    // sanitising runs AFTER and would strip any undeclared attribute.
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
    // For syntax highlighting, later.
    code: ['class'],
    th: ['align'],
    td: ['align'],
  },
  // The only place where we decide what a link may point at. `javascript:`,
  // `data:` and friends are not on the list, so the attribute is dropped.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // An outgoing link opened in a new tab without `rel` gives the target
    // page access to `window.opener`. Set systematically.
    a: (name, attribs) => {
      const href = attribs.href ?? ''
      const external = /^https?:\/\//i.test(href)
      return {
        tagName: name,
        attribs: external ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      }
    },
    img: (name, attribs) => ({ tagName: name, attribs: { ...attribs, loading: 'lazy' } }),
  },
}

/** Markdown → sanitised HTML. The only function allowed to produce article HTML. */
export function renderMarkdown(source: string): string {
  const raw = engine.parse(source ?? '', { async: false })
  return sanitizeHtml(raw, RULES)
}

/**
 * Character count, whitespace normalised. Feeds the displayed counter and
 * the reading-time estimate.
 */
export function countCharacters(source: string): number {
  return (source ?? '').replace(/\s+/g, ' ').trim().length
}

/**
 * Reading time in minutes, rounded up, minimum 1.
 *
 * 1,400 characters per minute, about 230 words — the low end of measured
 * French reading speeds. Better to announce slightly long.
 */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.ceil(countCharacters(source) / 1400))
}
