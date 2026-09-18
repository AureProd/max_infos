import { describe, expect, it } from 'vitest'
import { cvSchema } from '../../shared/schemas/settings'
import { publicCv } from '../../shared/utils/public-profile'

/**
 * Une rubrique masquée ne part pas.
 *
 * Les interrupteurs des rubriques datées étaient appliqués ici, avant que
 * la réponse ne sorte ; les listes de pastilles — compétences, langues,
 * certifications, centres d'intérêt — n'en avaient aucun. Elles sont
 * désormais commutables, groupe de compétences par groupe de compétences,
 * et la coupe se fait au même endroit : ce qui est masqué ne voyage pas.
 */
const base = cvSchema.parse({
  skills: [
    { group: 'Journalisme', items: ['Enquête'] },
    { group: 'Outils', items: ['Figma'], visible: false },
  ],
  languages: [{ label: 'Anglais', level: 'C1' }],
  certifications: ['CNIL'],
  interests: ['Vélo'],
})

describe('publicCv, sur les listes de pastilles', () => {
  it('sert par défaut tout ce qui n’a jamais été masqué', () => {
    const out = publicCv(cvSchema.parse({ certifications: ['CNIL'] }))
    expect(out.certifications).toEqual(['CNIL'])
  })

  it('retire un groupe de compétences masqué, garde les autres', () => {
    expect(publicCv(base).skills).toEqual([
      { group: 'Journalisme', items: ['Enquête'], visible: true },
    ])
  })

  it('vide une rubrique entière masquée', () => {
    const hidden = { ...base, listsVisible: { ...base.listsVisible, skills: false } }
    expect(publicCv(hidden).skills).toEqual([])
  })

  for (const key of ['languages', 'certifications', 'interests'] as const) {
    it(`vide « ${key} » quand la rubrique est masquée`, () => {
      const hidden = { ...base, listsVisible: { ...base.listsVisible, [key]: false } }
      expect(publicCv(hidden)[key]).toEqual([])
    })
  }
})
