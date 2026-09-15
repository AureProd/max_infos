import { describe, expect, it } from 'vitest'
import { listArticlesQuery, listSocialQuery, slugParam } from '#shared/schemas/api'

describe('listeArticlesQuery', () => {
  it('applique ses valeurs par défaut sur une requête nue', () => {
    expect(listArticlesQuery.parse({})).toEqual({ page: 1, size: 12 })
  })

  it('convertit les nombres venus de l’URL, qui sont des chaînes', () => {
    expect(listArticlesQuery.parse({ page: '3', size: '5' })).toMatchObject({
      page: 3,
      size: 5,
    })
  })

  it('borne la size de page', () => {
    // Sans borne, `?size=100000` ferait all load en mémoire.
    expect(() => listArticlesQuery.parse({ size: '500' })).toThrow()
    expect(() => listArticlesQuery.parse({ page: '0' })).toThrow()
  })

  it('refuse une recherche démesurée', () => {
    expect(() => listArticlesQuery.parse({ q: 'x'.repeat(300) })).toThrow()
  })

  it('rogne les espaces', () => {
    expect(listArticlesQuery.parse({ q: '  ia  ' }).q).toBe('ia')
  })
})

describe('listeSocialQuery', () => {
  it('n’accepte que les réseaux connus', () => {
    expect(listSocialQuery.parse({ network: 'instagram' }).network).toBe('instagram')
    expect(() => listSocialQuery.parse({ network: 'mastodon' })).toThrow()
  })
})

describe('slugParam', () => {
  it('accepte un slug normal', () => {
    expect(slugParam.parse('controler-lia')).toBe('controler-lia')
  })

  it('refuse ce qui n’est pas un slug', () => {
    // La borne qui account : rien qui puisse ressembler à un path.
    for (const wrong of ['../etc/passwd', 'Majuscule', 'deux--tirets', '-bord', 'bord-', 'a b']) {
      expect(() => slugParam.parse(wrong)).toThrow()
    }
  })
})
