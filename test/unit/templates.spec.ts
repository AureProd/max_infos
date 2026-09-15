import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, resolve, VARIABLES } from '../../server/utils/templates'

const CONTEXT = {
  title: "Contrôler l'IA",
  dek: 'Un chapô.',
  url: 'https://unmaxdinfo.fr/article/controler-lia',
  tags: 'geopolitique',
  minutes: 7,
  characters: 10013,
}

describe('template resolution', () => {
  it('replaces the known variables', () => {
    expect(resolve('{{titre}} — {{minutes}} min', CONTEXT)).toBe("Contrôler l'IA — 7 min")
  })

  it('tolerates spaces inside the braces', () => {
    expect(resolve('{{ titre }}', CONTEXT)).toBe("Contrôler l'IA")
  })

  it('replaces every occurrence', () => {
    expect(resolve('{{titre}} / {{titre}}', CONTEXT)).toBe("Contrôler l'IA / Contrôler l'IA")
  })

  it('LEAVES an unknown variable as it is', () => {
    // Erasing would be worse: Max would find a hole in his text without
    // understanding why. Left visible, the mistake gets fixed.
    expect(resolve('{{inexistante}}', CONTEXT)).toBe('{{inexistante}}')
  })

  it('does not touch text outside the braces', () => {
    expect(resolve('Rien à remplacer ici.', CONTEXT)).toBe('Rien à remplacer ici.')
  })

  it('handles an empty template', () => {
    expect(resolve('', CONTEXT)).toBe('')
  })

  it('the default templates only use recognised variables', () => {
    // A template shipped with an unknown variable would show its braces to
    // Max on first use.
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      for (const m of template.matchAll(/\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g)) {
        expect(VARIABLES).toContain(m[1])
      }
    }
  })

  it('the default templates resolve entirely', () => {
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      expect(resolve(template, CONTEXT)).not.toMatch(/\{\{/)
    }
  })
})
