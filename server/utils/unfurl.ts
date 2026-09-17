/**
 * What a page says about itself.
 *
 * No API will ever hand over a LinkedIn post: `r_member_social` is closed
 * to new applications, a constraint verified in September 2026 and not to
 * be relearnt. A post typed in by hand therefore arrived with neither title
 * nor image, and the card was bare.
 *
 * The OpenGraph tags a page serves to crawlers are the only thing left to
 * read. LinkedIn serves them unevenly — which is why nothing here throws:
 * an empty field is an honest answer, and the form stays editable.
 */

export interface OpenGraph {
  title: string
  description: string
  image: string
}

/** `&amp;`, `&#39;`, `&#x2014;` — entities are markup, not text. */
function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

/**
 * One `<meta>`, whatever the order of its attributes.
 *
 * LinkedIn writes `content` first. A pattern expecting `property` first
 * matches nothing — and says nothing about it.
 */
function meta(html: string, names: readonly string[]): string {
  for (const name of names) {
    const escaped = name.replace(':', '\\:')
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`,
        'i',
      ),
    ]
    for (const pattern of patterns) {
      const hit = pattern.exec(html)
      if (hit?.[1]) return decode(hit[1])
    }
  }
  return ''
}

export function readOpenGraph(html: string): OpenGraph {
  const title =
    meta(html, ['og:title', 'twitter:title']) ||
    decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')

  const image = meta(html, ['og:image', 'og:image:secure_url', 'twitter:image'])

  return {
    title,
    description: meta(html, ['og:description', 'twitter:description', 'description']),
    // A relative address would not load on our page: better nothing than a
    // broken image.
    image: /^https?:\/\//i.test(image) ? image : '',
  }
}
