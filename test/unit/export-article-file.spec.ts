import { describe, expect, it, vi } from 'vitest'

// The module calls createError at runtime only, but importing it pulls in the
// route helpers: the global is stubbed before the import, as in crypto.spec.ts.
vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { articleToFile } = await import('../../server/utils/export')

const ARTICLE = {
  slug: 'ben-mhidi',
  title: "Ben M'hidi",
  dek: 'Une enquête sur la mémoire.',
  status: 'published',
  publishedAt: new Date('2026-03-04T08:00:00.000Z'),
  substackUrl: 'https://unmaxdinfo.substack.com/p/ben-mhidi',
  bodyHtml: '<h2>Titre</h2><p>Le corps.</p>',
}

const frontMatter = (md: string) => md.split('---')[1] ?? ''

describe('articleToFile', () => {
  it('carries every field needed to rebuild the article', () => {
    const md = articleToFile(ARTICLE, ['mémoire', 'Algérie'])
    for (const key of ['slug', 'title', 'dek', 'status', 'publishedAt', 'tags', 'substackUrl']) {
      expect(frontMatter(md)).toContain(`${key}:`)
    }
    expect(md).toContain('\n<h2>Titre</h2><p>Le corps.</p>\n')
  })

  it('escapes the quotes that would break the front matter', () => {
    // A title is free text: an unescaped quote would cut the YAML value in
    // two, and the archive would no longer re-read.
    const md = articleToFile({ ...ARTICLE, title: 'Le "grand" soir' }, [])
    expect(md).toContain('title: "Le \\"grand\\" soir"')
  })

  it('escapes the backslash before the quote, not after', () => {
    // A title ending in a backslash would escape the closing quote of the
    // YAML value and swallow the next line. The backslash has to be doubled
    // FIRST, otherwise doubling it again breaks the quotes just escaped.
    expect(articleToFile({ ...ARTICLE, title: 'chemin\\' }, [])).toContain('title: "chemin\\\\"')
    expect(articleToFile({ ...ARTICLE, title: 'a\\"b' }, [])).toContain('title: "a\\\\\\"b"')
  })

  it('writes the publication date in three shapes without losing it', () => {
    // The column comes back as a Date through drizzle, as a string through a
    // JSON archive, and null on a draft.
    expect(articleToFile(ARTICLE, [])).toContain('publishedAt: "2026-03-04T08:00:00.000Z"')
    expect(articleToFile({ ...ARTICLE, publishedAt: '2026-03-04T08:00:00.000Z' }, [])).toContain(
      'publishedAt: "2026-03-04T08:00:00.000Z"',
    )
    expect(articleToFile({ ...ARTICLE, publishedAt: null }, [])).toContain('publishedAt: ""')
  })

  it('lists the tags as a YAML array', () => {
    expect(articleToFile(ARTICLE, [])).toContain('tags: []')
    expect(articleToFile(ARTICLE, ['a', 'b'])).toContain('tags: ["a", "b"]')
    expect(articleToFile(ARTICLE, ['l\'"IA"'])).toContain('tags: ["l\'\\"IA\\""]')
  })

  it('turns a missing field into an empty string, never into "undefined"', () => {
    // The literal word undefined in an archive would come back as an article
    // whose title is "undefined".
    const md = articleToFile({ slug: 'x' }, [])
    expect(md).not.toContain('undefined')
    expect(md).not.toContain('null')
    expect(md).toContain('title: ""')
    expect(md.endsWith('---\n\n\n')).toBe(true)
  })
})
