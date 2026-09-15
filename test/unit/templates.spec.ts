import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, resolve, VARIABLES } from '../../server/utils/templates'

const CONTEXT = {
  titre: "Contrôler l'IA",
  chapo: 'Un chapô.',
  url: 'https://unmaxdinfo.fr/article/controler-lia',
  tags: 'geopolitique',
  minutes: 7,
  caracteres: 10013,
}

describe('résolution des gabarits', () => {
  it('remplace les variables connues', () => {
    expect(resolve('{{titre}} — {{minutes}} min', CONTEXT)).toBe("Contrôler l'IA — 7 min")
  })

  it('tolère les espaces dans les accolades', () => {
    expect(resolve('{{ titre }}', CONTEXT)).toBe("Contrôler l'IA")
  })

  it('remplace toutes les occurrences', () => {
    expect(resolve('{{titre}} / {{titre}}', CONTEXT)).toBe("Contrôler l'IA / Contrôler l'IA")
  })

  it('LAISSE une variable inconnue telle quelle', () => {
    // Effacer serait pire : Max découvrirait un trou dans son text sans
    // comprendre pourquoi. Laissée visible, l'error se corrige.
    expect(resolve('{{inexistante}}', CONTEXT)).toBe('{{inexistante}}')
  })

  it('ne touche pas au texte hors accolades', () => {
    expect(resolve('Rien à remplacer ici.', CONTEXT)).toBe('Rien à remplacer ici.')
  })

  it('gère un gabarit vide', () => {
    expect(resolve('', CONTEXT)).toBe('')
  })

  it('les gabarits par défaut n’utilisent que des variables reconnues', () => {
    // Un template livré avec une variable inconnue afficherait ses accolades
    // à Max dès le first usage.
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      for (const m of template.matchAll(/\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g)) {
        expect(VARIABLES).toContain(m[1])
      }
    }
  })

  it('les gabarits par défaut se résolvent entièrement', () => {
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      expect(resolve(template, CONTEXT)).not.toMatch(/\{\{/)
    }
  })
})
