import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '#shared/utils/markdown'

describe('renderMarkdown', () => {
  it('rend les blocs usuels', () => {
    expect(renderMarkdown('## Titre')).toBe('<h2>Titre</h2>')
    expect(renderMarkdown('un paragraphe')).toBe('<p>un paragraphe</p>')
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
    expect(renderMarkdown('> cité')).toBe('<blockquote><p>cité</p></blockquote>')
    expect(renderMarkdown('---')).toBe('<hr>')
  })

  it('délimite les blocs de code par ~~~ et non par des accents graves', () => {
    expect(renderMarkdown('~~~\nconst a = 1\n~~~')).toBe('<pre><code>const a = 1</code></pre>')
  })

  it('rend le gras, l’italique et le code en ligne', () => {
    expect(renderMarkdown('**gras**')).toBe('<p><strong>gras</strong></p>')
    expect(renderMarkdown('*ital*')).toBe('<p><em>ital</em></p>')
    expect(renderMarkdown('`code`')).toBe('<p><code>code</code></p>')
  })

  it('échappe le HTML du texte', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('rend un lien normal', () => {
    expect(renderMarkdown('[Substack](https://unmaxdinfo.substack.com/)')).toBe(
      '<p><a href="https://unmaxdinfo.substack.com/">Substack</a></p>',
    )
  })

  // Les trois suivants couvrent la faille du moteur d'origine, qui écrivait
  // href="$2" sans rien vérifier. Sans objet tant que seul Max écrit — mais
  // l'import Substack du lot 3 fera passer ici du texte qu'il n'a pas écrit.
  it('neutralise une cible javascript:', () => {
    expect(renderMarkdown('[clic](javascript:alert(1))')).toContain('href="#"')
    expect(renderMarkdown('[clic](javascript:alert(1))')).not.toContain('javascript:')
  })

  it('neutralise une cible data:', () => {
    expect(renderMarkdown('[clic](data:text/html,<script>x</script>)')).toContain('href="#"')
  })

  it('empêche un guillemet de fabriquer un attribut', () => {
    const rendu = renderMarkdown('[clic](https://x" onmouseover="alert(1))')
    expect(rendu).not.toContain('onmouseover="alert')
    expect(rendu).toContain('&quot;')
  })
})
