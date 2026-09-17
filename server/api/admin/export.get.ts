import { eq } from 'drizzle-orm'
import { strToU8, zipSync } from 'fflate'
import { useDatabase } from '~~/server/database/client'
import { articleTag, tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { articleToFile, buildExport } from '~~/server/utils/export'

/**
 * Full export, as a ZIP ARCHIVE.
 *
 * Articles appear in it TWICE: as JSON for re-import, and as Markdown with
 * front matter for reading. That is not useless redundancy — an archive you
 * can only open with the software that produced it is not a backup, it is a
 * dependency. The .md files open in any editor, ten years from now.
 *
 * What is NOT in it: the `secret` table, and the files themselves, which
 * live in R2 — the archive carries only their references.
 *
 * The archive is built IN MEMORY: it holds nothing but text, a few hundred
 * kilobytes even with hundreds of articles. A stream would complicate the
 * code for nothing — the heavy files are not in there.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'developer')

  const archive = await buildExport()
  const day = new Date().toISOString().slice(0, 10)
  const root = `export-${day}`

  // Each article's tags, for the front matter of the .md files.
  const db = useDatabase()
  const links = await db
    .select({ articleId: articleTag.articleId, label: tag.label })
    .from(articleTag)
    .innerJoin(tag, eq(tag.id, articleTag.tagId))

  const files: Record<string, Uint8Array> = {}

  const add = (path: string, content: unknown): void => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    files[`${root}/${path}`] = strToU8(text)
  }

  add('manifest.json', archive.manifest)
  add('data/articles.json', archive.articles)
  add('data/tags.json', archive.tags)
  add('data/links.json', {
    tags: archive.tagLinks,
    social: archive.socialLinks,
  })
  add('data/social_accounts.json', archive.socialAccounts)
  add('data/social_posts.json', archive.socialPosts)
  add('data/settings.json', archive.settings)
  add('data/users.json', archive.users)
  add('data/views.json', archive.views)
  // The R2 keys and the dimensions, not the bytes.
  add('media/manifest.json', archive.media)

  for (const a of archive.articles as Record<string, unknown>[]) {
    const tags = links.filter((l) => l.articleId === a.id).map((l) => l.label)
    add(`articles/${a.slug}.html`, articleToFile(a, tags))
  }

  // A README inside the archive: two years from now, nobody will remember
  // what each folder holds.
  add(
    'LISEZ-MOI.txt',
    `Export de unmaxdinfo.fr — ${archive.manifest.exportedAt}
Version de schéma : ${archive.manifest.version}

  articles/*.md        les articles, lisibles tels quels (front-matter + Markdown)
  data/*.json          les données, pour le réimport
  media/manifest.json  les références des fichiers — ils vivent dans Cloudflare R2
                       et ne sont PAS dans cette archive

Ne contient aucun jeton d'accès : les secrets ne sont jamais exportés.

Réimporter : POST /api/admin/import avec le contenu des data/*.json
assemblés, ou la commande d'import de l'application.
`,
  )

  const zip = zipSync(files, { level: 9 })

  setHeader(event, 'content-type', 'application/zip')
  setHeader(event, 'content-disposition', `attachment; filename="${root}.zip"`)
  setHeader(event, 'content-length', zip.byteLength)
  return zip
})
