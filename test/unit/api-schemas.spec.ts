import { describe, expect, it } from 'vitest'
import { listArticlesQuery, listSocialQuery, slugParam } from '#shared/schemas/api'

describe('listeArticlesQuery', () => {
  it('applies its defaults on a bare query', () => {
    expect(listArticlesQuery.parse({})).toEqual({ page: 1, size: 12 })
  })

  it('converts the numbers coming from the URL, which are strings', () => {
    expect(listArticlesQuery.parse({ page: '3', size: '5' })).toMatchObject({
      page: 3,
      size: 5,
    })
  })

  it('bounds the page size', () => {
    // Unbounded, `?size=100000` would load everything into memory.
    expect(() => listArticlesQuery.parse({ size: '500' })).toThrow()
    expect(() => listArticlesQuery.parse({ page: '0' })).toThrow()
  })

  it('refuses an oversized search', () => {
    expect(() => listArticlesQuery.parse({ q: 'x'.repeat(300) })).toThrow()
  })

  it('trims whitespace', () => {
    expect(listArticlesQuery.parse({ q: '  ia  ' }).q).toBe('ia')
  })
})

describe('listeSocialQuery', () => {
  it('accepts only the known networks', () => {
    expect(listSocialQuery.parse({ network: 'instagram' }).network).toBe('instagram')
    expect(() => listSocialQuery.parse({ network: 'mastodon' })).toThrow()
  })
})

describe('slugParam', () => {
  it('accepts a normal slug', () => {
    expect(slugParam.parse('controler-lia')).toBe('controler-lia')
  })

  it('refuses anything that is not a slug', () => {
    // The bound that counts: nothing that could look like a path.
    for (const wrong of ['../etc/passwd', 'Majuscule', 'deux--tirets', '-bord', 'bord-', 'a b']) {
      expect(() => slugParam.parse(wrong)).toThrow()
    }
  })
})
