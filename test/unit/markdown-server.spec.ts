import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countCharacters, readingMinutes, renderMarkdown } from '../../server/utils/markdown'

describe('reference Markdown rendering', () => {
  it('renders the usual blocks', () => {
    expect(renderMarkdown('## Titre')).toContain('<h2>Titre</h2>')
    expect(renderMarkdown('- a\n- b')).toContain('<li>a</li>')
    expect(renderMarkdown('> cité')).toContain('<blockquote>')
    expect(renderMarkdown('**gras**')).toContain('<strong>gras</strong>')
    expect(renderMarkdown('_ital_')).toContain('<em>ital</em>')
  })

  it('renders italics from underscores, which the home-made engine did not', () => {
    // Les articles existants utilisent _..._ : le engine de la maquette les
    // laissait tels quels, visible dans le text.
    expect(renderMarkdown('un _mot_ souligné')).toContain('<em>mot</em>')
  })

  it('accepts code blocks fenced with ~~~', () => {
    // Convention retenue pour rester lisible dans un field de input.
    expect(renderMarkdown('~~~\nconst a = 1\n~~~')).toContain('<pre>')
  })
})

describe('sanitising', () => {
  it('strips active tags', () => {
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

  it('strips event handlers', () => {
    const rendered = renderMarkdown('<p onclick="alert(1)">texte</p>')
    expect(rendered).not.toContain('onclick')
    expect(rendered).toContain('texte')
  })

  it('neutralises dangerous link targets', () => {
    for (const wrong of ['javascript:alert(1)', 'data:text/html,<script>x</script>']) {
      const rendered = renderMarkdown(`[clic](${wrong})`)
      expect(rendered).not.toContain('javascript:')
      expect(rendered).not.toContain('data:text/html')
    }
  })

  it('lets legitimate links through', () => {
    const rendered = renderMarkdown('[Substack](https://unmaxdinfo.substack.com/)')
    expect(rendered).toContain('href="https://unmaxdinfo.substack.com/"')
  })

  it('sets rel="noopener" on outgoing links', () => {
    // Without it, the target page reaches window.opener and can redirect
    // ours. Set systematically rather than left to vigilance.
    const rendered = renderMarkdown('[x](https://exemple.test)')
    expect(rendered).toContain('rel="noopener noreferrer"')
    expect(rendered).toContain('target="_blank"')
  })

  it('does not set target on an internal link', () => {
    expect(renderMarkdown('[x](/article/y)')).not.toContain('target="_blank"')
  })

  it('refuses a data: image', () => {
    expect(renderMarkdown('![x](data:image/svg+xml;base64,AAAA)')).not.toContain('data:image')
  })
})

describe('measurements', () => {
  it('counts characters with whitespace normalised', () => {
    expect(countCharacters('un   deux\n\ttrois')).toBe('un deux trois'.length)
    expect(countCharacters('  abc  ')).toBe(3)
  })

  it('announces at least one minute', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('court')).toBe(1)
  })

  it('rounds up', () => {
    expect(readingMinutes('x'.repeat(1401))).toBe(2)
    expect(readingMinutes('x'.repeat(1400))).toBe(1)
  })
})

/**
 * THE GOLDEN TEST the plan calls for.
 *
 * It does not compare the two engines — they differ, that is the point. It
 * pins
 * ce que le nouveau produit sur les VRAIS articles, pour que la bascule ne
 * casse rien en silence et qu'on sache ce que le CSS `.prose` doit couvrir.
 */
describe('the five real articles', () => {
  const FOLDER = join(process.cwd(), 'scripts/seed/content')
  const files = readdirSync(FOLDER).filter((f) => f.endsWith('.md'))

  it('there really are five articles to render', () => {
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

  it('inventories the tags produced, so the CSS covers them', () => {
    const tagNames = new Set<string>()
    for (const f of files) {
      const rendered = renderMarkdown(readFileSync(join(FOLDER, f), 'utf8'))
      for (const m of rendered.matchAll(/<([a-z0-9]+)[\s>]/g)) tagNames.add(m[1] as string)
    }
    // The REAL inventory of the five articles, observed and not assumed:
    // neither bold nor blockquote appears in them today. Pinned on purpose —
    // if the rendering starts producing a tag `.prose` does not style, this
    // test says so before it shows up on the page.
    expect([...tagNames].sort()).toEqual(['a', 'em', 'h2', 'li', 'p', 'ul'])
  })
})
