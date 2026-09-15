import { describe, expect, it } from 'vitest'
import { slugify } from '#shared/utils/slug'

describe('slugify', () => {
  it('retire les accents', () => {
    expect(slugify('géopolitique')).toBe('geopolitique')
    expect(slugify('Mémoire')).toBe('memoire')
    expect(slugify('août')).toBe('aout')
  })

  it('coupe sur l’apostrophe plutôt que de coller les mots', () => {
    expect(slugify("l'IA")).toBe('l-ia')
    expect(slugify('l’Europe')).toBe('l-europe')
  })

  it('ne laisse ni tiret en bordure ni tiret double', () => {
    expect(slugify('  Sport et pouvoir  ')).toBe('sport-et-pouvoir')
    expect(slugify('a -- b')).toBe('a-b')
    expect(slugify('!!!')).toBe('')
  })

  it('produit ce que le schéma de route accepte', () => {
    const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    for (const t of ['Géopolitique', 'Cultures urbaines', 'Sport & pouvoir', 'Europe']) {
      expect(slugify(t)).toMatch(pattern)
    }
  })
})
