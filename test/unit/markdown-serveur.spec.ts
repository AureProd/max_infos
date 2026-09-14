import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compterCaracteres, minutesDeLecture, rendreMarkdown } from '../../server/utils/markdown'

describe('rendu Markdown de référence', () => {
  it('rend les blocs usuels', () => {
    expect(rendreMarkdown('## Titre')).toContain('<h2>Titre</h2>')
    expect(rendreMarkdown('- a\n- b')).toContain('<li>a</li>')
    expect(rendreMarkdown('> cité')).toContain('<blockquote>')
    expect(rendreMarkdown('**gras**')).toContain('<strong>gras</strong>')
    expect(rendreMarkdown('_ital_')).toContain('<em>ital</em>')
  })

  it('rend l’italique avec des tirets bas, ce que le moteur maison ne faisait pas', () => {
    // Les articles existants utilisent _..._ : le moteur de la maquette les
    // laissait tels quels, visibles dans le texte.
    expect(rendreMarkdown('un _mot_ souligné')).toContain('<em>mot</em>')
  })

  it('accepte les blocs de code délimités par ~~~', () => {
    // Convention retenue pour rester lisible dans un champ de saisie.
    expect(rendreMarkdown('~~~\nconst a = 1\n~~~')).toContain('<pre>')
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
      const rendu = rendreMarkdown(hostile)
      expect(rendu).not.toMatch(/<(script|iframe|style|form|input)/i)
    }
  })

  it('retire les gestionnaires d’événements', () => {
    const rendu = rendreMarkdown('<p onclick="alert(1)">texte</p>')
    expect(rendu).not.toContain('onclick')
    expect(rendu).toContain('texte')
  })

  it('neutralise les cibles de lien dangereuses', () => {
    for (const mauvais of ['javascript:alert(1)', 'data:text/html,<script>x</script>']) {
      const rendu = rendreMarkdown(`[clic](${mauvais})`)
      expect(rendu).not.toContain('javascript:')
      expect(rendu).not.toContain('data:text/html')
    }
  })

  it('laisse passer les liens légitimes', () => {
    const rendu = rendreMarkdown('[Substack](https://unmaxdinfo.substack.com/)')
    expect(rendu).toContain('href="https://unmaxdinfo.substack.com/"')
  })

  it('pose rel="noopener" sur les liens sortants', () => {
    // Sans lui, la page cible accède à window.opener et peut rediriger la
    // nôtre. Posé systématiquement plutôt que laissé à la vigilance.
    const rendu = rendreMarkdown('[x](https://exemple.test)')
    expect(rendu).toContain('rel="noopener noreferrer"')
    expect(rendu).toContain('target="_blank"')
  })

  it('ne pose pas target sur un lien interne', () => {
    expect(rendreMarkdown('[x](/article/y)')).not.toContain('target="_blank"')
  })

  it('refuse une image en data:', () => {
    expect(rendreMarkdown('![x](data:image/svg+xml;base64,AAAA)')).not.toContain('data:image')
  })
})

describe('mesures', () => {
  it('compte les caractères espaces normalisées', () => {
    expect(compterCaracteres('un   deux\n\ttrois')).toBe('un deux trois'.length)
    expect(compterCaracteres('  abc  ')).toBe(3)
  })

  it('annonce au moins une minute', () => {
    expect(minutesDeLecture('')).toBe(1)
    expect(minutesDeLecture('court')).toBe(1)
  })

  it('arrondit au-dessus', () => {
    expect(minutesDeLecture('x'.repeat(1401))).toBe(2)
    expect(minutesDeLecture('x'.repeat(1400))).toBe(1)
  })
})

/**
 * LE TEST D'OR prévu au plan.
 *
 * Il ne compare pas les deux moteurs — ils diffèrent, c'est le but. Il fixe
 * ce que le nouveau produit sur les VRAIS articles, pour que la bascule ne
 * casse rien en silence et qu'on sache ce que le CSS `.prose` doit couvrir.
 */
describe('les cinq articles réels', () => {
  const DOSSIER = join(process.cwd(), 'scripts/seed/content')
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith('.md'))

  it('il y a bien cinq articles à rendre', () => {
    expect(fichiers).toHaveLength(5)
  })

  it.each(fichiers)('%s : rendu sans balise hostile ni Markdown résiduel', (fichier) => {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')
    const rendu = rendreMarkdown(source)

    expect(rendu.length).toBeGreaterThan(source.length / 2)
    expect(rendu).not.toMatch(/<(script|iframe|style|form)/i)
    expect(rendu).not.toContain('javascript:')
    // Aucun marqueur Markdown ne doit subsister dans le texte rendu.
    expect(rendu).not.toMatch(/(^|\n)#{2,3}\s/)
    expect(rendu).not.toMatch(/\*\*[^*]+\*\*/)
  })

  it('inventorie les balises produites, pour que le CSS les couvre', () => {
    const balises = new Set<string>()
    for (const f of fichiers) {
      const rendu = rendreMarkdown(readFileSync(join(DOSSIER, f), 'utf8'))
      for (const m of rendu.matchAll(/<([a-z0-9]+)[\s>]/g)) balises.add(m[1] as string)
    }
    // Inventaire RÉEL des cinq articles, relevé et non supposé : ni gras ni
    // citation n'y figurent aujourd'hui. Fixé volontairement — si le rendu
    // se met à produire une balise que `.prose` ne style pas, ce test le dit
    // avant que ça se voie en ligne.
    expect([...balises].sort()).toEqual(['a', 'em', 'h2', 'li', 'p', 'ul'])
  })
})
