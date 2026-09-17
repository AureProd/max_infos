import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * The body of an article: sanitised SERVER-SIDE at save time, never on read.
 *
 * The editor now hands over HTML — Markdown only survives for the one-way
 * conversions, the Substack import and the archives already produced. Which
 * MOVES the security question rather than removing it: it used to be
 * impossible to store unsafe markup because the only way in was Markdown,
 * rendered by us. `sanitizeArticleHtml` is now the single door, and it is
 * the only function allowed to produce the HTML that goes into the column.
 *
 * Three consequences, and they are the whole point:
 *  - displaying an article costs no rendering;
 *  - the HTML served is safe BY CONSTRUCTION, not because someone
 *    remembered to sanitise at every place that displays it;
 *  - the back-office preview goes through the same function, so it cannot
 *    drift from the published rendering.
 */

/**
 * The reference Markdown rendering.
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
    'span',
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
    // `class` sur un paragraphe, et sur lui seul : c'est ce qui porte les
    // boutons Substack que l'éditeur insère. Une classe libre sur n'importe
    // quelle balise laisserait le corps d'un article repeindre la page.
    p: ['class'],
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

/**
 * HTML → HTML, à la liste blanche. LA porte d'entrée du corps d'un article.
 *
 * Tout ce qui n'est pas dans `RULES` disparaît : un `<script>`, un
 * `<iframe>`, un attribut d'événement, un `href` en `javascript:`.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html ?? '', RULES)
}

/**
 * Markdown → HTML assaini.
 *
 * Ne sert plus à l'édition : l'éditeur écrit du HTML. Reste pour l'import
 * Substack et pour les archives produites avant la bascule, qui portent du
 * Markdown.
 */
export function renderMarkdown(source: string): string {
  const raw = engine.parse(source ?? '', { async: false })
  return sanitizeHtml(raw, RULES)
}

/**
 * Le texte brut d'un corps HTML.
 *
 * C'est sur lui que porte la recherche, et de lui que viennent les
 * compteurs. La recherche cherchait dans le Markdown : un article contenant
 * « **souveraineté** » ne répondait pas à « souveraineté », et compter la
 * source annonçait des temps de lecture faux — « <p><strong>Bonjour</strong>
 * </p> » fait 31 caractères pour 7 de lecture.
 *
 * Les balises deviennent une ESPACE et non rien : collés, « Titre » et
 * « Un » formaient « TitreUn », introuvable.
 */
export function htmlToText(html: string): string {
  // L'espace est posée AVANT l'assainissement : `sanitize-html` retire les
  // balises sans rien mettre à la place, et « <p>Titre</p><p>Un</p> »
  // devenait « TitreUn ». Assainir ensuite, et non l'inverse, est ce qui
  // fait disparaître le CONTENU d'un <script> au lieu de le verser dans le
  // texte indexé.
  const spaced = (html ?? '').replace(
    /<\/(p|h[1-6]|li|blockquote|div|figcaption|td|th|tr|br)\s*\/?>/gi,
    ' ',
  )
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
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

/**
 * The fields derived from the body, recomputed on every save.
 *
 * The HTML is sanitised HERE and nowhere else: that is what guarantees no
 * unsafe markup ever enters the database, now that the editor hands over
 * HTML directly rather than Markdown.
 *
 * Les compteurs portent sur le TEXTE : « <p><strong>Bonjour</strong></p> »
 * fait 31 caractères de source pour 7 de lecture, et compter la source
 * annonçait des temps faux.
 *
 * Vit dans CE fichier, et non dans `articles.ts`, parce que le script de
 * semis l'appelle : il tourne sous `tsx`, qui ne connaît pas l'alias
 * `#shared` dont `articles.ts` dépend. Même raison que le commentaire de
 * `server/database/schema/enums.ts`.
 */
export function derivedFields(bodyHtml: string) {
  const html = sanitizeArticleHtml(bodyHtml)
  const text = htmlToText(html)
  return {
    bodyHtml: html,
    bodyText: text,
    charCount: countCharacters(text),
    readingMinutes: readingMinutes(text),
  }
}

/** Les mêmes champs, depuis un corps en Markdown — l'import Substack. */
export function derivedFromMarkdown(bodyMd: string) {
  return derivedFields(renderMarkdown(bodyMd))
}
