import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

// `derivedFields` vit dans markdown.ts : le script de semis l'appelle, et
// il tourne sous tsx, qui ne connaît pas l'alias #shared d'articles.ts.
const { derivedFields } = await import('../../server/utils/markdown')

describe('derivedFields', () => {
  it('renders the body and counts it in one pass', () => {
    // These three fields are stored alongside the article: they must be
    // computed from the SAME text, or the listing would contradict the page.
    const d = derivedFields('<h2>Titre</h2><p>Un corps de texte.</p>')
    expect(d.bodyHtml).toContain('<h2')
    expect(d.bodyHtml).toContain('Un corps de texte.')
    // Le texte brut alimente la recherche, et les compteurs portent sur LUI :
    // « <p><strong>Bonjour</strong></p> » fait 31 caractères de source pour 7
    // de lecture.
    expect(d.bodyText).toBe('Titre Un corps de texte.')
    expect(d.charCount).toBe(24)
    expect(d.readingMinutes).toBe(1)
  })

  it('sanitises what the rendered HTML carries', () => {
    // bodyHtml is injected with v-html: a script surviving here would run in
    // every visitor's browser.
    const d = derivedFields('<p>Bonjour</p><script>alert(1)</script><img src=x onerror=alert(1)>')
    expect(d.bodyHtml).not.toContain('<script')
    expect(d.bodyHtml).not.toContain('onerror')
  })

  it('grows the reading time with the text', () => {
    const short = derivedFields(`<p>${'mot '.repeat(50)}</p>`)
    const long = derivedFields(`<p>${'mot '.repeat(5000)}</p>`)
    expect(long.readingMinutes).toBeGreaterThan(short.readingMinutes)
    expect(long.charCount).toBeGreaterThan(short.charCount)
  })

  it('survives an empty body rather than failing the save', () => {
    expect(derivedFields('')).toEqual({
      bodyHtml: '',
      bodyText: '',
      charCount: 0,
      readingMinutes: 1,
    })
  })
})
