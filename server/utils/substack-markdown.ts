import { parseDocument } from 'htmlparser2'

/**
 * A Substack body, turned into the Markdown the site stores.
 *
 * Written against what the real feed CONTAINS, inventoried rather than
 * imagined: no heading, no list, no quote, no footnote — but spans by the
 * hundred, images wrapped three deep, and subscription widgets made of a
 * button and an inline svg. The tags that do not appear yet are handled all
 * the same; they cost four lines each and spare a surprise.
 *
 * Parsed with htmlparser2, never with a regular expression. CLAUDE.md is
 * explicit, and the reason shows here: `<scr<b>ipt>` defeats one pass of
 * `/<[^>]+>/g`, and nested wrappers defeat every pass.
 *
 * What comes out is REVIEWED by a human: the import writes drafts, never
 * publications. The converter is allowed to be imperfect; it is not allowed
 * to be silent about a tag it does not know — hence the flattening, which
 * keeps the text of anything unrecognised.
 */

// The node types are DERIVED from what parseDocument returns, rather than
// imported from `domhandler`: that package is htmlparser2's own dependency,
// not resolvable from here, and declaring it directly would add a second
// entry to package.json for two type aliases.
type ChildNode = ReturnType<typeof parseDocument>['children'][number]
type Element = Extract<ChildNode, { attribs: Record<string, string> }>

/** Dropped whole, contents included: none of it belongs in an article. */
const DISCARDED = new Set([
  'button',
  'svg',
  'script',
  'style',
  'form',
  'iframe',
  'noscript',
  'source',
  'head',
])

/** Opens a block: what precedes is flushed, what follows starts afresh. */
const BLOCKS = new Set([
  'p',
  'div',
  'figure',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'tr',
])

const isTag = (n: ChildNode): n is Element => n.type === 'tag'

const image = (n: Element): string => `![${n.attribs.alt ?? ''}](${n.attribs.src ?? ''})`

/** A link whose whole content is one image — Substack's « see it larger ». */
const IMAGE_ONLY = /^!\[[^\]]*\]\([^)]*\)$/

function inline(nodes: ChildNode[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') {
      // Collapsed, not stripped: the space between two spans is a real space.
      out += n.data.replace(/\s+/g, ' ')
      continue
    }
    if (!isTag(n)) continue
    if (DISCARDED.has(n.name)) continue

    switch (n.name) {
      case 'br':
        out += '\n'
        break
      case 'img':
        out += image(n)
        break
      case 'em':
      case 'i': {
        const inner = inline(n.children).trim()
        out += inner ? `_${inner}_` : ''
        break
      }
      case 'strong':
      case 'b': {
        const inner = inline(n.children).trim()
        out += inner ? `**${inner}**` : ''
        break
      }
      case 'code': {
        const inner = inline(n.children).trim()
        out += inner ? `\`${inner}\`` : ''
        break
      }
      case 'a': {
        const inner = inline(n.children).trim()
        const href = n.attribs.href ?? ''
        // An image wrapped in a link to itself, larger: the link adds
        // nothing and would give `[![…](…)](…)`.
        if (IMAGE_ONLY.test(inner)) out += inner
        else if (inner && href) out += `[${inner}](${href})`
        else out += inner
        break
      }
      // span, and everything else: flattened, text kept.
      default:
        out += inline(n.children)
    }
  }
  return out
}

function blocks(nodes: ChildNode[]): string[] {
  const out: string[] = []
  let buffer = ''

  const flush = (): void => {
    const text = buffer.replace(/[ \t]+\n/g, '\n').trim()
    if (text) out.push(text)
    buffer = ''
  }

  for (const n of nodes) {
    if (isTag(n) && DISCARDED.has(n.name)) continue

    if (!isTag(n) || !BLOCKS.has(n.name)) {
      buffer += inline([n])
      continue
    }

    flush()

    switch (n.name) {
      case 'h1':
      case 'h2':
        // h1 is the page title, and the site's renderer refuses it in a
        // body: starting at h2 keeps the round trip faithful.
        out.push(`## ${inline(n.children).trim()}`)
        break
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        out.push(`### ${inline(n.children).trim()}`)
        break
      case 'hr':
        out.push('---')
        break
      case 'ul':
      case 'ol': {
        const items = n.children.filter(isTag).filter((c) => c.name === 'li')
        const lines = items
          .map((c, i) => `${n.name === 'ol' ? `${i + 1}.` : '-'} ${inline(c.children).trim()}`)
          .filter((l) => l.length > 2)
        if (lines.length) out.push(lines.join('\n'))
        break
      }
      case 'blockquote': {
        const inner = blocks(n.children).join('\n\n')
        if (inner) {
          out.push(
            inner
              .split('\n')
              .map((l) => (l ? `> ${l}` : '>'))
              .join('\n'),
          )
        }
        break
      }
      default:
        out.push(...blocks(n.children))
    }
  }

  flush()
  return out
}

/** HTML → Markdown. Empty in, empty out: an article without a body must save. */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return blocks(parseDocument(html).children as ChildNode[]).join('\n\n')
}
