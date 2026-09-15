import { describe, expect, it } from 'vitest'
import {
  controlerCollisionsDeCasse,
  controlerFichier,
  TAILLE_MAX_KO,
} from '../../scripts/hooks/hygiene.mjs'

/** Raccourci : les règles déclenchées par un file, sans le détail. */
function rules(path: string, content: string | Buffer): string[] {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  return controlerFichier({ path, content: bytes }).map((p) => p.regle)
}

describe('espaces en fin de ligne', () => {
  it('les signale dans un fichier de code', () => {
    expect(rules('app/x.ts', 'const a = 1   \nconst b = 2\n')).toContain('espaces-en-fin-de-ligne')
  })

  // La typographie française des articles ne doit pas être retouchée : en
  // Markdown, two espaces en fin de row sont un back à la row voulu.
  it('les tolère en Markdown', () => {
    expect(rules('docs/x.md', 'une ligne  \nune autre\n')).not.toContain('espaces-en-fin-de-ligne')
  })
})

describe('fin de fichier', () => {
  it('exige une nouvelle ligne finale', () => {
    expect(rules('app/x.ts', 'const a = 1')).toContain('newline-finale')
  })

  it('accepte un fichier vide', () => {
    expect(rules('app/x.ts', '')).toEqual([])
  })
})

describe('fins de ligne', () => {
  it('refuse CRLF', () => {
    expect(rules('app/x.ts', 'const a = 1\r\n')).toContain('fin-de-ligne-mixte')
  })
})

describe('marqueurs de conflit', () => {
  it('refuse un conflit non résolu', () => {
    const content = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> autre', ''].join('\n')
    expect(rules('app/x.ts', content)).toContain('marqueur-de-conflit')
  })

  it('ne confond pas avec une suite de chevrons dans du texte', () => {
    expect(rules('app/x.ts', 'const fleche = "<<<<<<<"\n')).not.toContain('marqueur-de-conflit')
  })
})

describe('fichiers volumineux', () => {
  it(`refuse au-delà de ${TAILLE_MAX_KO} ko`, () => {
    const large = Buffer.alloc((TAILLE_MAX_KO + 1) * 1024, 0x61)
    expect(rules('public/gros.bin', large)).toContain('fichier-volumineux')
  })
})

describe('fichiers binaires', () => {
  it('ne leur applique aucun contrôle de texte', () => {
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x20])
    expect(rules('public/img.png', binary)).toEqual([])
  })
})

describe('YAML', () => {
  it('refuse un document invalide', () => {
    expect(rules('deploy/x.yml', 'a:\n  - b\n c: d\n')).toContain('yaml-invalide')
  })

  it('accepte plusieurs documents dans un même fichier', () => {
    expect(rules('deploy/x.yml', 'a: 1\n---\nb: 2\n')).not.toContain('yaml-invalide')
  })
})

describe('JSON', () => {
  it('refuse un document invalide', () => {
    expect(rules('x.json', '{"a": 1,}\n')).toContain('json-invalide')
  })

  // Biome se configure en JSONC : commentaires et virgules finales y sont
  // légitimes, JSON.parse les refuserait.
  it('laisse passer le JSONC', () => {
    expect(rules('biome.jsonc', '{ /* un commentaire */ "a": 1 }\n')).not.toContain('json-invalide')
  })
})

describe('collisions de casse', () => {
  it('refuse deux chemins qui ne diffèrent que par la casse', () => {
    const problems = controlerCollisionsDeCasse(['app/Article.vue', 'app/article.vue'])
    expect(problems.map((p) => p.regle)).toContain('collision-de-casse')
  })

  it('accepte des chemins réellement distincts', () => {
    expect(controlerCollisionsDeCasse(['app/a.vue', 'app/b.vue'])).toEqual([])
  })
})
