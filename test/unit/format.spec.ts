import { describe, expect, it } from 'vitest'
import { countChars, frDate, frShort, nb } from '#shared/utils/format'

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
    expect(nb(1234567)).toBe('1 234 567')
  })

  it('laisse les petits nombres intacts', () => {
    expect(nb(0)).toBe('0')
    expect(nb(999)).toBe('999')
    expect(nb(1000)).toBe('1 000')
  })

  it('produit TOUJOURS le même octet, quelle que soit la version d’ICU', () => {
    // C'est le cœur du tag : `toLocaleString('fr-FR')` renvoie U+202F ou
    // U+00A0 selon l'ICU embarquée. Le serveur et le navigateur rendraient
    // alors two bytes différents, et Vue signalerait un écart
    // d'hydratation sur chaque count affiché.
    const rendered = nb(10013)
    expect(rendered).not.toContain(' ')
    expect(rendered).not.toContain(' ') // espace ordinaire
    expect([...rendered].map((c) => c.codePointAt(0))).toEqual([
      0x31, 0x30, 0x202f, 0x30, 0x31, 0x33,
    ])
  })
})

describe('countChars', () => {
  it('normalise les espaces avant de compter', () => {
    expect(countChars('un   deux\n\ttrois')).toBe(countChars('un deux trois'))
    expect(countChars('abc')).toBe(3)
  })

  it('traite les espaces insécables françaises comme des espaces', () => {
    expect(countChars('oui : non')).toBe(countChars('oui : non'))
    expect(countChars('un 000')).toBe(countChars('un 000'))
  })
})
