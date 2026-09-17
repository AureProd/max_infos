import { describe, expect, it } from 'vitest'
import { readOpenGraph } from '../../server/utils/unfurl'

/**
 * Reading the OpenGraph tags of a pasted link.
 *
 * No API will ever hand over a LinkedIn post — `r_member_social` is closed
 * to new applications — so a post typed in by hand arrived with neither
 * title nor image, and the card was bare. What a page says about itself to
 * crawlers is the only thing left to read.
 *
 * Parsed here, never fetched: the network belongs to the route, so these
 * cases cover the shapes that actually break a regex — attribute order,
 * single quotes, entities, and a page that says nothing at all.
 */
describe('reading the tags', () => {
  it('takes title, description and image', () => {
    const html = `
      <meta property="og:title" content="Un titre" />
      <meta property="og:description" content="Une description" />
      <meta property="og:image" content="https://exemple.test/i.jpg" />`
    expect(readOpenGraph(html)).toEqual({
      title: 'Un titre',
      description: 'Une description',
      image: 'https://exemple.test/i.jpg',
    })
  })

  it('reads the attributes in the other order', () => {
    // LinkedIn writes content first. A regex expecting property first
    // returns nothing at all, and silently.
    const html = `<meta content="Un titre" property="og:title">`
    expect(readOpenGraph(html).title).toBe('Un titre')
  })

  it('accepts single quotes', () => {
    expect(readOpenGraph(`<meta property='og:title' content='Un titre'>`).title).toBe('Un titre')
  })

  it('unescapes the entities, which are not text', () => {
    const html = `<meta property="og:title" content="Sport &amp; pouvoir &#8212; l&#39;enquête">`
    expect(readOpenGraph(html).title).toBe("Sport & pouvoir — l'enquête")
  })

  it('falls back to <title> when OpenGraph says nothing', () => {
    expect(readOpenGraph('<title>Le titre de la page</title>').title).toBe('Le titre de la page')
  })

  it('reads twitter:image when there is no og:image', () => {
    const html = `<meta name="twitter:image" content="https://exemple.test/t.jpg">`
    expect(readOpenGraph(html).image).toBe('https://exemple.test/t.jpg')
  })

  it('returns empty fields rather than guessing', () => {
    // A page that says nothing must leave the form blank for Max to fill,
    // not be filled with something invented.
    expect(readOpenGraph('<html><body>rien</body></html>')).toEqual({
      title: '',
      description: '',
      image: '',
    })
  })

  it('ignores a relative image, which would not load', () => {
    const html = `<meta property="og:image" content="/img/local.jpg">`
    expect(readOpenGraph(html).image).toBe('')
  })
})
