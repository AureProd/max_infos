import { describe, expect, it } from 'vitest'
import { countChars, frDate, frShort, nb } from './format.js'

describe('frDate', () => {
  it('rend une date française complète', () => {
    expect(frDate('2026-09-12')).toBe('12 septembre 2026')
  })

  it('ne décale pas le jour selon le fuseau', () => {
    expect(frDate('2026-01-01')).toBe('1 janvier 2026')
    expect(frDate('2026-12-31')).toBe('31 décembre 2026')
  })
})

describe('frShort', () => {
  it('abrège le mois à quatre lettres', () => {
    expect(frShort('2026-09-12')).toBe('12 sept.')
    expect(frShort('2026-05-03')).toBe('3 mai.')
  })
})

describe('nb', () => {
  it('groupe les milliers à la française', () => {
    // Selon la version d'ICU, le séparateur de milliers est une espace fine
    // insécable (U+202F) ou une espace insécable (U+00A0) : on normalise.
    expect(nb(1234567).replace(/[\u202f\u00a0\s]/g, ' ')).toBe('1 234 567')
  })
})

describe('countChars', () => {
  it('normalise les espaces avant de compter', () => {
    expect(countChars('un   deux\n\ttrois')).toBe(countChars('un deux trois'))
    expect(countChars('abc')).toBe(3)
  })
})
