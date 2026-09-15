import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { derivedFields } = await import('../../server/utils/articles')

describe('derivedFields', () => {
  it('renders the body and counts it in one pass', () => {
    // These three fields are stored alongside the article: they must be
    // computed from the SAME text, or the listing would contradict the page.
    const d = derivedFields('## Titre\n\nUn corps de texte.')
    expect(d.bodyHtml).toContain('<h2')
    expect(d.bodyHtml).toContain('Un corps de texte.')
    expect(d.charCount).toBeGreaterThan(0)
    expect(d.readingMinutes).toBe(1)
  })

  it('sanitises what the rendered HTML carries', () => {
    // bodyHtml is injected with v-html: a script surviving here would run in
    // every visitor's browser.
    const d = derivedFields('Bonjour <script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect(d.bodyHtml).not.toContain('<script')
    expect(d.bodyHtml).not.toContain('onerror')
  })

  it('grows the reading time with the text', () => {
    const short = derivedFields('mot '.repeat(50))
    const long = derivedFields('mot '.repeat(5000))
    expect(long.readingMinutes).toBeGreaterThan(short.readingMinutes)
    expect(long.charCount).toBeGreaterThan(short.charCount)
  })

  it('survives an empty body rather than failing the save', () => {
    expect(derivedFields('')).toEqual({ bodyHtml: '', charCount: 0, readingMinutes: 1 })
  })
})
