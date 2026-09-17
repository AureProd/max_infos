import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { archiveFromZip, SCHEMA_VERSION } from '../../server/utils/export'

/**
 * Reading back the archive the site hands out.
 *
 * The export produced a ZIP and the import accepted nothing but raw JSON:
 * the backup downloaded from the Technique screen could not be restored
 * with it. Whoever wanted their production content locally had no way in.
 *
 * The layout read here is the one `export.get.ts` writes — that is the
 * whole contract, and the reason this test exists rather than a comment.
 */
const zip = (files: Record<string, string>): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))

const complete = (root = 'export-2026-09-17'): Record<string, string> => ({
  [`${root}/manifest.json`]: JSON.stringify({
    version: SCHEMA_VERSION,
    exportedAt: '2026-09-17T10:00:00.000Z',
    counts: { articles: 1 },
  }),
  [`${root}/data/articles.json`]: JSON.stringify([{ slug: 'un-article' }]),
  [`${root}/data/tags.json`]: JSON.stringify([{ slug: 'geo' }]),
  [`${root}/data/links.json`]: JSON.stringify({ tags: [{ articleId: 1 }], social: [] }),
  [`${root}/data/social_accounts.json`]: JSON.stringify([]),
  [`${root}/data/social_posts.json`]: JSON.stringify([{ id: 4 }]),
  [`${root}/data/settings.json`]: JSON.stringify([{ key: 'identity' }]),
  [`${root}/data/users.json`]: JSON.stringify([{ email: 'jb@exemple.fr' }]),
  [`${root}/data/views.json`]: JSON.stringify([]),
  [`${root}/media/manifest.json`]: JSON.stringify([{ id: 2 }]),
  [`${root}/articles/un-article.md`]: '# Un article',
})

describe('reading a downloaded backup', () => {
  it('gives back everything the export wrote', () => {
    const archive = archiveFromZip(zip(complete()))
    expect(archive.manifest.version).toBe(SCHEMA_VERSION)
    expect(archive.articles).toHaveLength(1)
    expect(archive.tagLinks).toHaveLength(1)
    expect(archive.socialPosts).toHaveLength(1)
    expect(archive.media).toHaveLength(1)
    expect(archive.users).toHaveLength(1)
  })

  it('finds its way whatever the folder is called', () => {
    // The root carries the day of the export: pinning its name would break
    // the restore of any backup but today's.
    expect(archiveFromZip(zip(complete('export-2025-01-01'))).articles).toHaveLength(1)
  })

  it('ignores the Markdown, which is there for humans', () => {
    // Articles appear twice in the archive: as JSON to restore, as .md to
    // read. Restoring must read the JSON, never parse the prose.
    expect(archiveFromZip(zip(complete())).articles).toEqual([{ slug: 'un-article' }])
  })

  it('refuses a zip that carries no manifest', () => {
    expect(() => archiveFromZip(zip({ 'rien/du-tout.txt': 'bonjour' }))).toThrow()
  })

  it('refuses something that is not a zip at all', () => {
    expect(() => archiveFromZip(strToU8('ceci est un texte'))).toThrow()
  })

  it('treats a missing section as empty rather than failing', () => {
    // An older archive may not carry every file. Restoring what is there
    // beats refusing the whole thing.
    const partial = complete()
    delete partial['export-2026-09-17/data/views.json']
    expect(archiveFromZip(zip(partial)).views).toEqual([])
  })
})
