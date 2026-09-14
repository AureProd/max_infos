import { describe, expect, it } from 'vitest'
import { listeArticlesQuery, listeSocialQuery, slugParam } from '#shared/schemas/api'

describe('listeArticlesQuery', () => {
  it('applique ses valeurs par défaut sur une requête nue', () => {
    expect(listeArticlesQuery.parse({})).toEqual({ page: 1, taille: 12 })
  })

  it('convertit les nombres venus de l’URL, qui sont des chaînes', () => {
    expect(listeArticlesQuery.parse({ page: '3', taille: '5' })).toMatchObject({
      page: 3,
      taille: 5,
    })
  })

  it('borne la taille de page', () => {
    // Sans borne, `?taille=100000` ferait tout charger en mémoire.
    expect(() => listeArticlesQuery.parse({ taille: '500' })).toThrow()
    expect(() => listeArticlesQuery.parse({ page: '0' })).toThrow()
  })

  it('refuse une recherche démesurée', () => {
    expect(() => listeArticlesQuery.parse({ q: 'x'.repeat(300) })).toThrow()
  })

  it('rogne les espaces', () => {
    expect(listeArticlesQuery.parse({ q: '  ia  ' }).q).toBe('ia')
  })
})

describe('listeSocialQuery', () => {
  it('n’accepte que les réseaux connus', () => {
    expect(listeSocialQuery.parse({ network: 'instagram' }).network).toBe('instagram')
    expect(() => listeSocialQuery.parse({ network: 'mastodon' })).toThrow()
  })
})

describe('slugParam', () => {
  it('accepte un slug normal', () => {
    expect(slugParam.parse('controler-lia')).toBe('controler-lia')
  })

  it('refuse ce qui n’est pas un slug', () => {
    // La borne qui compte : rien qui puisse ressembler à un chemin.
    for (const mauvais of ['../etc/passwd', 'Majuscule', 'deux--tirets', '-bord', 'bord-', 'a b']) {
      expect(() => slugParam.parse(mauvais)).toThrow()
    }
  })
})
