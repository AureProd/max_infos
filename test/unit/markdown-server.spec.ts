import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countCharacters, readingMinutes, renderMarkdown } from '../../server/utils/markdown'

describe('rendu Markdown de référence', () => {
  it('rend les blocs usuels', () => {
    expect(renderMarkdown('## Titre')).toContain('<h2>Titre</h2>')
    expect(renderMarkdown('- a\n- b')).toContain('<li>a</li>')
    expect(renderMarkdown('> cité')).toContain('<blockquote>')
    expect(renderMarkdown('**gras**')).toContain('<strong>gras</strong>')
    expect(renderMarkdown('_ital_')).toContain('<em>ital</em>')
  })

  it('rend l’italique avec des tirets bas, ce que le moteur maison ne faisait pas', () => {
    // Les articles existants utilisent _..._ : le engine de la maquette les
    // laissait tels quels, visible dans le text.
    expect(renderMarkdown('un _mot_ souligné')).toContain('<em>mot</em>')
  })

  it('accepte les blocs de code délimités par ~~~', () => {
    // Convention retenue pour rester lisible dans un field de input.
    expect(renderMarkdown('~~~\nconst a = 1\n~~~')).toContain('<pre>')
  })
})

describe('assainissement', () => {
  it('retire les balises actives', () => {
    for (const hostile of [
      '<script>alert(1)</script>',
      '<iframe src="https://x"></iframe>',
      '<style>body{display:none}</style>',
      '<form action="/x"><input name="a"></form>',
    ]) {
      const rendered = renderMarkdown(hostile)
      expect(rendered).not.toMatch(/<(script|iframe|style|form|input)/i)
    }
  })

  it('retire les gestionnaires d’événements', () => {
    const rendered = renderMarkdown('<p onclick="alert(1)">texte</p>')
    expect(rendered).not.toContain('onclick')
    expect(rendered).toContain('texte')
  })

  it('neutralise les cibles de lien dangereuses', () => {
    for (const wrong of ['javascript:alert(1)', 'data:text/html,<script>x</script>']) {
      const rendered = renderMarkdown(`[clic](${wrong})`)
      expect(rendered).not.toContain('javascript:')
      expect(rendered).not.toContain('data:text/html')
    }
  })

  it('laisse passer les liens légitimes', () => {
    const rendered = renderMarkdown('[Substack](https://unmaxdinfo.substack.com/)')
    expect(rendered).toContain('href="https://unmaxdinfo.substack.com/"')
  })

  it('pose rel="noopener" sur les liens sortants', () => {
    // Sans lui, la page target accède à window.opener et peut rediriger la
    // nôtre. Posé systématiquement plutôt que laissé à la vigilance.
    const rendered = renderMarkdown('[x](https://exemple.test)')
    expect(rendered).toContain('rel="noopener noreferrer"')
    expect(rendered).toContain('target="_blank"')
  })

  it('ne pose pas target sur un lien interne', () => {
    expect(renderMarkdown('[x](/article/y)')).not.toContain('target="_blank"')
  })

  it('refuse une image en data:', () => {
    expect(renderMarkdown('![x](data:image/svg+xml;base64,AAAA)')).not.toContain('data:image')
  })
})

describe('mesures', () => {
  it('compte les caractères espaces normalisées', () => {
    expect(countCharacters('un   deux\n\ttrois')).toBe('un deux trois'.length)
    expect(countCharacters('  abc  ')).toBe(3)
  })

  it('annonce au moins une minute', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('court')).toBe(1)
  })

  it('arrondit au-dessus', () => {
    expect(readingMinutes('x'.repeat(1401))).toBe(2)
    expect(readingMinutes('x'.repeat(1400))).toBe(1)
  })
})

/**
 * LE TEST D'OR prévu au plan.
 *
 * Il ne compare pas les two moteurs — ils diffèrent, c'est le but. Il fixe
 * ce que le nouveau produit sur les VRAIS articles, pour que la bascule ne
 * casse rien en silence et qu'on sache ce que le CSS `.prose` doit couvrir.
 */
describe('les cinq articles réels', () => {
  const FOLDER = join(process.cwd(), 'scripts/seed/content')
  const files = readdirSync(FOLDER).filter((f) => f.endsWith('.md'))

  it('il y a bien cinq articles à rendre', () => {
    expect(files).toHaveLength(5)
  })

  it.each(files)('%s : rendu sans balise hostile ni Markdown résiduel', (file) => {
    const source = readFileSync(join(FOLDER, file), 'utf8')
    const rendered = renderMarkdown(source)

    expect(rendered.length).toBeGreaterThan(source.length / 2)
    expect(rendered).not.toMatch(/<(script|iframe|style|form)/i)
    expect(rendered).not.toContain('javascript:')
    // Aucun marqueur Markdown ne doit subsister dans le text rendered.
    expect(rendered).not.toMatch(/(^|\n)#{2,3}\s/)
    expect(rendered).not.toMatch(/\*\*[^*]+\*\*/)
  })

  it('inventorie les balises produites, pour que le CSS les couvre', () => {
    const tagNames = new Set<string>()
    for (const f of files) {
      const rendered = renderMarkdown(readFileSync(join(FOLDER, f), 'utf8'))
      for (const m of rendered.matchAll(/<([a-z0-9]+)[\s>]/g)) tagNames.add(m[1] as string)
    }
    // Inventaire RÉEL des cinq articles, relevé et non supposé : ni gras ni
    // citation n'y figurent aujourd'hui. Fixé volontairement — si le rendered
    // se met à produire une tagName que `.prose` ne style pas, ce test le dit
    // before que ça se voie en row.
    expect([...tagNames].sort()).toEqual(['a', 'em', 'h2', 'li', 'p', 'ul'])
  })
})
