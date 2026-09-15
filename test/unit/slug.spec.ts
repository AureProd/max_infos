import { describe, expect, it } from 'vitest'
import { slugify } from '#shared/utils/slug'

describe('slugify', () => {
  it('strips accents', () => {
    expect(slugify('géopolitique')).toBe('geopolitique')
    expect(slugify('Mémoire')).toBe('memoire')
    expect(slugify('août')).toBe('aout')
  })

  it('splits on the apostrophe rather than gluing words together', () => {
    expect(slugify("l'IA")).toBe('l-ia')
    expect(slugify('l’Europe')).toBe('l-europe')
  })

  it('leaves neither a leading dash nor a double dash', () => {
    expect(slugify('  Sport et pouvoir  ')).toBe('sport-et-pouvoir')
    expect(slugify('a -- b')).toBe('a-b')
    expect(slugify('!!!')).toBe('')
  })

  it('produces what the route schema accepts', () => {
    const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    for (const t of ['Géopolitique', 'Cultures urbaines', 'Sport & pouvoir', 'Europe']) {
      expect(slugify(t)).toMatch(pattern)
    }
  })
})
