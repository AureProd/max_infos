import { describe, expect, it } from 'vitest'
import {
  controlerCollisionsDeCasse,
  controlerFichier,
  TAILLE_MAX_KO,
} from '../../scripts/hooks/hygiene.mjs'

/** Raccourci : les règles déclenchées par un fichier, sans le détail. */
function regles(chemin: string, contenu: string | Buffer): string[] {
  const octets = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, 'utf8')
  return controlerFichier({ chemin, contenu: octets }).map((p) => p.regle)
}

describe('espaces en fin de ligne', () => {
  it('les signale dans un fichier de code', () => {
    expect(regles('app/x.ts', 'const a = 1   \nconst b = 2\n')).toContain('espaces-en-fin-de-ligne')
  })

  // La typographie française des articles ne doit pas être retouchée : en
  // Markdown, deux espaces en fin de ligne sont un retour à la ligne voulu.
  it('les tolère en Markdown', () => {
    expect(regles('docs/x.md', 'une ligne  \nune autre\n')).not.toContain('espaces-en-fin-de-ligne')
  })
})

describe('fin de fichier', () => {
  it('exige une nouvelle ligne finale', () => {
    expect(regles('app/x.ts', 'const a = 1')).toContain('newline-finale')
  })

  it('accepte un fichier vide', () => {
    expect(regles('app/x.ts', '')).toEqual([])
  })
})

describe('fins de ligne', () => {
  it('refuse CRLF', () => {
    expect(regles('app/x.ts', 'const a = 1\r\n')).toContain('fin-de-ligne-mixte')
  })
})

describe('marqueurs de conflit', () => {
  it('refuse un conflit non résolu', () => {
    const contenu = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> autre', ''].join('\n')
    expect(regles('app/x.ts', contenu)).toContain('marqueur-de-conflit')
  })

  it('ne confond pas avec une suite de chevrons dans du texte', () => {
    expect(regles('app/x.ts', 'const fleche = "<<<<<<<"\n')).not.toContain('marqueur-de-conflit')
  })
})

describe('fichiers volumineux', () => {
  it(`refuse au-delà de ${TAILLE_MAX_KO} ko`, () => {
    const gros = Buffer.alloc((TAILLE_MAX_KO + 1) * 1024, 0x61)
    expect(regles('public/gros.bin', gros)).toContain('fichier-volumineux')
  })
})

describe('fichiers binaires', () => {
  it('ne leur applique aucun contrôle de texte', () => {
    const binaire = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x20])
    expect(regles('public/img.png', binaire)).toEqual([])
  })
})

describe('YAML', () => {
  it('refuse un document invalide', () => {
    expect(regles('deploy/x.yml', 'a:\n  - b\n c: d\n')).toContain('yaml-invalide')
  })

  it('accepte plusieurs documents dans un même fichier', () => {
    expect(regles('deploy/x.yml', 'a: 1\n---\nb: 2\n')).not.toContain('yaml-invalide')
  })
})

describe('JSON', () => {
  it('refuse un document invalide', () => {
    expect(regles('x.json', '{"a": 1,}\n')).toContain('json-invalide')
  })

  // Biome se configure en JSONC : commentaires et virgules finales y sont
  // légitimes, JSON.parse les refuserait.
  it('laisse passer le JSONC', () => {
    expect(regles('biome.jsonc', '{ /* un commentaire */ "a": 1 }\n')).not.toContain(
      'json-invalide',
    )
  })
})

describe('collisions de casse', () => {
  it('refuse deux chemins qui ne diffèrent que par la casse', () => {
    const problemes = controlerCollisionsDeCasse(['app/Article.vue', 'app/article.vue'])
    expect(problemes.map((p) => p.regle)).toContain('collision-de-casse')
  })

  it('accepte des chemins réellement distincts', () => {
    expect(controlerCollisionsDeCasse(['app/a.vue', 'app/b.vue'])).toEqual([])
  })
})
