import { describe, expect, it } from 'vitest'
import { GABARITS_PAR_DEFAUT, resoudre, VARIABLES } from '../../server/utils/gabarits'

const CONTEXTE = {
  titre: "Contrôler l'IA",
  chapo: 'Un chapô.',
  url: 'https://unmaxdinfo.fr/article/controler-lia',
  sujets: 'geopolitique',
  minutes: 7,
  caracteres: 10013,
}

describe('résolution des gabarits', () => {
  it('remplace les variables connues', () => {
    expect(resoudre('{{titre}} — {{minutes}} min', CONTEXTE)).toBe("Contrôler l'IA — 7 min")
  })

  it('tolère les espaces dans les accolades', () => {
    expect(resoudre('{{ titre }}', CONTEXTE)).toBe("Contrôler l'IA")
  })

  it('remplace toutes les occurrences', () => {
    expect(resoudre('{{titre}} / {{titre}}', CONTEXTE)).toBe("Contrôler l'IA / Contrôler l'IA")
  })

  it('LAISSE une variable inconnue telle quelle', () => {
    // Effacer serait pire : Max découvrirait un trou dans son texte sans
    // comprendre pourquoi. Laissée visible, l'erreur se corrige.
    expect(resoudre('{{inexistante}}', CONTEXTE)).toBe('{{inexistante}}')
  })

  it('ne touche pas au texte hors accolades', () => {
    expect(resoudre('Rien à remplacer ici.', CONTEXTE)).toBe('Rien à remplacer ici.')
  })

  it('gère un gabarit vide', () => {
    expect(resoudre('', CONTEXTE)).toBe('')
  })

  it('les gabarits par défaut n’utilisent que des variables reconnues', () => {
    // Un gabarit livré avec une variable inconnue afficherait ses accolades
    // à Max dès le premier usage.
    for (const gabarit of Object.values(GABARITS_PAR_DEFAUT)) {
      for (const m of gabarit.matchAll(/\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g)) {
        expect(VARIABLES).toContain(m[1])
      }
    }
  })

  it('les gabarits par défaut se résolvent entièrement', () => {
    for (const gabarit of Object.values(GABARITS_PAR_DEFAUT)) {
      expect(resoudre(gabarit, CONTEXTE)).not.toMatch(/\{\{/)
    }
  })
})
