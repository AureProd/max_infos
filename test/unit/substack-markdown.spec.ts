import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../server/utils/substack-markdown'

/**
 * Converting a Substack body into Markdown.
 *
 * The fixtures below reproduce the SHAPES observed in the real feed — the
 * wrapper markup Substack generates, not anyone's prose. What the inventory
 * showed: no heading, no list, no quote, no footnote; but spans everywhere,
 * captioned images wrapped three deep, and subscription widgets made of a
 * button and an inline svg.
 */

describe('what the body really contains', () => {
  it('unwraps the spans Substack scatters through a paragraph', () => {
    // 165 spans across five posts, all of them pure wrapping.
    const html =
      '<p><span>Un début </span><em><span>accentué</span></em><span> et la suite.</span></p>'
    expect(htmlToMarkdown(html)).toBe('Un début _accentué_ et la suite.')
  })

  it('keeps bold and italics, which carry meaning', () => {
    expect(htmlToMarkdown('<p><strong>Gras</strong> et <em>italique</em>.</p>')).toBe(
      '**Gras** et _italique_.',
    )
  })

  it('separates paragraphs by a blank line', () => {
    expect(htmlToMarkdown('<p>Un.</p><p>Deux.</p>')).toBe('Un.\n\nDeux.')
  })

  it('turns a line break into a real one', () => {
    expect(htmlToMarkdown('<p>Une ligne<br>une autre</p>')).toBe('Une ligne\nune autre')
  })

  it('writes a link the way Markdown does', () => {
    expect(htmlToMarkdown('<p>Voir <a href="https://exemple.test/a">la source</a>.</p>')).toBe(
      'Voir [la source](https://exemple.test/a).',
    )
  })
})

describe('the noise Substack adds', () => {
  it('drops a subscription widget whole, button and icon', () => {
    // A button and an inline svg, wrapped in Substack's own classes. Nothing
    // of it belongs in an article, and its text least of all.
    const html =
      '<p>Le texte.</p>' +
      '<div class="button-wrapper"><button type="button" class="pencraft pc-reset">' +
      '<svg viewBox="0 0 20 20"><g><path d="M2 7"/></g></svg>S’abonner</button></div>'
    expect(htmlToMarkdown(html)).toBe('Le texte.')
  })

  it('drops a bare icon without swallowing its neighbour', () => {
    const html = '<p>Avant<svg><line x1="1"/></svg>après</p>'
    expect(htmlToMarkdown(html)).toBe('Avantaprès')
  })
})

describe('the images', () => {
  it('pulls the image out of its three wrappers', () => {
    // div.captioned-image-container > figure > a > picture > source + img.
    // Only the img carries what Markdown needs.
    const html =
      '<div class="captioned-image-container"><figure>' +
      '<a class="image-link" href="https://cdn.test/grand.png">' +
      '<picture><source type="image/webp" srcset="https://cdn.test/petit.webp"/>' +
      '<img src="https://cdn.test/image.png" alt="Une légende" width="1080"/>' +
      '</picture></a></figure></div>'
    expect(htmlToMarkdown(html)).toBe('![Une légende](https://cdn.test/image.png)')
  })

  it('does not make the image a link to itself', () => {
    // The wrapping <a> points at the same picture, larger. Keeping it would
    // give `[![…](…)](…)` for nothing.
    const html =
      '<figure><a href="https://cdn.test/grand.png">' +
      '<img src="https://cdn.test/image.png" alt="Légende"/></a></figure>'
    expect(htmlToMarkdown(html)).not.toContain('](https://cdn.test/grand.png)')
  })

  it('survives an image without alt text', () => {
    expect(htmlToMarkdown('<figure><img src="https://cdn.test/a.png"/></figure>')).toBe(
      '![](https://cdn.test/a.png)',
    )
  })
})

describe('what the feed does not contain today, but might tomorrow', () => {
  it('converts headings, below the article title', () => {
    // h1 is the page title: the site refuses it in a body, and markdown.ts
    // strips it. Starting at h2 keeps the round trip faithful.
    expect(htmlToMarkdown('<h2>Un titre</h2>')).toBe('## Un titre')
    expect(htmlToMarkdown('<h3>Un sous-titre</h3>')).toBe('### Un sous-titre')
    expect(htmlToMarkdown('<h1>Un titre de page</h1>')).toBe('## Un titre de page')
  })

  it('converts lists and quotes', () => {
    expect(htmlToMarkdown('<ul><li>un</li><li>deux</li></ul>')).toBe('- un\n- deux')
    expect(htmlToMarkdown('<ol><li>un</li><li>deux</li></ol>')).toBe('1. un\n2. deux')
    expect(htmlToMarkdown('<blockquote><p>Cité.</p></blockquote>')).toBe('> Cité.')
  })
})

describe('what comes out is what the site accepts', () => {
  it('escapes nothing it does not have to, and leaves no tag behind', () => {
    const html =
      '<div><p><span>Texte </span><a href="https://exemple.test">lien</a></p>' +
      '<button>S’abonner</button><figure><img src="https://cdn.test/a.png" alt="A"/></figure></div>'
    const md = htmlToMarkdown(html)
    expect(md).not.toMatch(/<[a-z]/i)
    expect(md).toBe('Texte [lien](https://exemple.test)\n\n![A](https://cdn.test/a.png)')
  })

  it('gives an empty string rather than failing on an empty body', () => {
    expect(htmlToMarkdown('')).toBe('')
    expect(htmlToMarkdown(undefined as never)).toBe('')
  })

  it('never leaves more than one blank line', () => {
    // Three empty paragraphs in a row is Substack's usual spacing.
    expect(htmlToMarkdown('<p>Un.</p><p></p><p></p><p>Deux.</p>')).toBe('Un.\n\nDeux.')
  })
})
