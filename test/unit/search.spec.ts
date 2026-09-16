import { describe, expect, it } from 'vitest'
import { ACCENT_MAP, escapeLike, foldAccents, likePattern } from '../../server/utils/search'

/**
 * Accent- and wildcard-safe search.
 *
 * Measured against the real stack before being fixed: « Algerie » returned
 * 0 while « Algérie » returned 2, and « % » returned every article.
 */
describe('accent table', () => {
  it('maps exactly one replacement per character', () => {
    // Were the two strings of different lengths, `translate` would silently
    // DELETE the characters in excess — a search quietly returning wrong
    // rows rather than an error.
    expect([...ACCENT_MAP.from]).toHaveLength([...ACCENT_MAP.to].length)
  })

  it('agrees with the folding applied to the query', () => {
    // Both sides must fold identically, otherwise the comparison misses.
    for (const [i, char] of [...ACCENT_MAP.from].entries()) {
      const bySql = [...ACCENT_MAP.to][i]
      const byJs = foldAccents(char)
      // `ø` has no decomposition: it is mapped by hand on both sides.
      if (char !== 'ø') expect(byJs).toBe(bySql)
    }
  })
})

describe('foldAccents', () => {
  it('strips accents and lowercases', () => {
    expect(foldAccents('Algérie')).toBe('algerie')
    expect(foldAccents('GÉOPOLITIQUE')).toBe('geopolitique')
  })

  it('leaves plain text alone', () => {
    expect(foldAccents('fifa')).toBe('fifa')
  })
})

describe('escapeLike', () => {
  it('neutralises the wildcards', () => {
    expect(escapeLike('100%')).toBe('100\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
    expect(escapeLike('c:\\x')).toBe('c:\\\\x')
  })
})

describe('likePattern', () => {
  it('folds and escapes in one go', () => {
    expect(likePattern('Algérie')).toBe('%algerie%')
    expect(likePattern('%')).toBe('%\\%%')
  })
})
