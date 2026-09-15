import { describe, expect, it } from 'vitest'
import { checkCaseCollisions, checkFile, MAX_SIZE_KB } from '../../scripts/hooks/hygiene.mjs'

/** Shorthand: the rules a file triggers, without the detail. */
function rules(path: string, content: string | Buffer): string[] {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  return checkFile({ path, content: bytes }).map((p) => p.rule)
}

describe('trailing whitespace', () => {
  it('reports it in a code file', () => {
    expect(rules('app/x.ts', 'const a = 1   \nconst b = 2\n')).toContain('trailing-whitespace')
  })

  // French typography in articles must not be touched up: in Markdown, two
  // trailing spaces are a deliberate line break.
  it('tolerates it in Markdown', () => {
    expect(rules('docs/x.md', 'une ligne  \nune autre\n')).not.toContain('trailing-whitespace')
  })
})

describe('end of file', () => {
  it('requires a final newline', () => {
    expect(rules('app/x.ts', 'const a = 1')).toContain('final-newline')
  })

  it('accepts an empty file', () => {
    expect(rules('app/x.ts', '')).toEqual([])
  })
})

describe('line endings', () => {
  it('refuses CRLF', () => {
    expect(rules('app/x.ts', 'const a = 1\r\n')).toContain('mixed-line-ending')
  })
})

describe('conflict markers', () => {
  it('refuses an unresolved conflict', () => {
    const content = ['<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> other', ''].join('\n')
    expect(rules('app/x.ts', content)).toContain('conflict-marker')
  })

  it('does not confuse it with a run of angle brackets in text', () => {
    expect(rules('app/x.ts', 'const arrow = "<<<<<<<"\n')).not.toContain('conflict-marker')
  })
})

describe('large files', () => {
  it(`refuses anything beyond ${MAX_SIZE_KB} kB`, () => {
    const big = Buffer.alloc((MAX_SIZE_KB + 1) * 1024, 0x61)
    expect(rules('public/big.bin', big)).toContain('large-file')
  })
})

describe('binary files', () => {
  it('applies no text check to them', () => {
    const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x20])
    expect(rules('public/img.png', binary)).toEqual([])
  })
})

describe('YAML', () => {
  it('refuses an invalid document', () => {
    expect(rules('deploy/x.yml', 'a:\n  - b\n c: d\n')).toContain('invalid-yaml')
  })

  it('accepts several documents in one file', () => {
    expect(rules('deploy/x.yml', 'a: 1\n---\nb: 2\n')).not.toContain('invalid-yaml')
  })
})

describe('JSON', () => {
  it('refuses an invalid document', () => {
    expect(rules('x.json', '{"a": 1,}\n')).toContain('invalid-json')
  })

  // Biome is configured in JSONC: comments and trailing commas are
  // legitimate there, JSON.parse would refuse them.
  it('lets JSONC through', () => {
    expect(rules('biome.jsonc', '{ /* a comment */ "a": 1 }\n')).not.toContain('invalid-json')
  })
})

describe('case collisions', () => {
  it('refuses two paths differing only by case', () => {
    const problems = checkCaseCollisions(['app/Article.vue', 'app/article.vue'])
    expect(problems.map((p) => p.rule)).toContain('case-collision')
  })

  it('accepts genuinely distinct paths', () => {
    expect(checkCaseCollisions(['app/a.vue', 'app/b.vue'])).toEqual([])
  })
})
