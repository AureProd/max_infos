/**
 * Reading the Substack RSS feed, for the initial migration.
 *
 * Substack exposes no API. Its RSS feed is the only usable source, and it
 * is enough: title, link, date, dek, body as HTML and above all the cover
 * image URL, which nobody wants to re-upload by hand for every article
 * already published.
 *
 * Parsing is done by hand, without an XML dependency. A deliberate and
 * bounded choice: this code reads ONE known feed, once. The tests cover
 * what actually breaks a Substack feed — CDATA, entities, and images in an
 * attribute. If one day we read arbitrary feeds, a real parser will be
 * needed; until then, one more dependency for a single-use script is not
 * justified.
 */

export interface ArticleSubstack {
  title: string
  link: string
  publishedAt: string | null
  dek: string
  bodyHtml: string
  cover: string | null
}

/** Decodes the XML entities Substack actually produces. */
function decode(text: string): string {
  return (
    text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Last, otherwise « &amp;lt; » would become « < » instead of « &lt; ».
      .replace(/&amp;/g, '&')
      .trim()
  )
}

/** The content of a fragment's first `<name>` tag, or an empty string. */
function tagName(fragment: string, name: string): string {
  const m = fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m?.[1] ? decode(m[1]) : ''
}

/** The value of an attribute on the first self-closing `<name …>` tag. */
function attribute(fragment: string, name: string, attr: string): string | null {
  const m = fragment.match(new RegExp(`<${name}\\s[^>]*${attr}="([^"]*)"`, 'i'))
  return m?.[1] ? decode(m[1]) : null
}

/**
 * An article's cover: `<enclosure>` when Substack provided one, otherwise
 * the first image in the body.
 *
 * Both exist depending on how old the post is, and an article without a
 * cover looks wrong everywhere it gets shared — which is precisely what we
 * came here for.
 */
function coverOf(item: string, bodyHtml: string): string | null {
  const enclosure = attribute(item, 'enclosure', 'url')
  if (enclosure?.startsWith('http')) return enclosure
  const img = bodyHtml.match(/<img\s[^>]*src="([^"]+)"/i)
  return img?.[1] ?? null
}

/** An RFC-822 date as ISO, or `null` when unreadable. */
function dateIso(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Strips the tags, until the text stops changing.
 *
 * ONE pass is not enough: it rebuilds what it removes. Stripping `<b>` out
 * of `<scr<b>ipt>` leaves `<script>` — the sanitisation hands back exactly
 * what it was meant to take away. The loop is bounded by the fact that
 * every pass strictly shortens the text.
 */
function stripTags(html: string): string {
  let text = html
  let previous: string
  do {
    previous = text
    text = text.replace(/<[^>]*>/g, '')
  } while (text !== previous)
  // A truncated tag leaves its delimiters behind: the dek is plain text,
  // so neither of them has anything to do here.
  return text.replace(/[<>]/g, '').trim()
}

export function parseSubstackFeed(xml: string): ArticleSubstack[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return items
    .map((item) => {
      // `content:encoded` carries the full body; `description` holds only
      // the dek. Confusing them would import truncated articles.
      const bodyHtml = tagName(item, 'content:encoded')
      return {
        title: tagName(item, 'title'),
        link: tagName(item, 'link'),
        publishedAt: dateIso(tagName(item, 'pubDate')),
        dek: stripTags(tagName(item, 'description')),
        bodyHtml,
        cover: coverOf(item, bodyHtml),
      }
    })
    .filter((a) => a.title !== '' && a.link !== '')
}
