import { eq } from 'drizzle-orm'
import { strToU8, zipSync } from 'fflate'
import { useDatabase } from '~~/server/database/client'
import { articleTag, tag } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { articleToMarkdown, buildExport } from '~~/server/utils/export'

/**
 * Export complet, sous shape d'ARCHIVE ZIP.
 *
 * Les articles y figurent DEUX FOIS : en JSON pour le réimport, et en
 * Markdown avec front-matter pour la lecture. Ce n'est pas une redondance
 * inutile — une archive qu'on ne peut ouvrir qu'avec le logiciel qui l'a
 * produite n'est pas une sauvegarde, c'est une dépendance. Les .md
 * s'ouvrent dans n'importe quel éditeur, dans dix ans.
 *
 * N'y figurent PAS : la table `secret`, et les files eux-mêmes, qui
 * vivent dans R2 — l'archive ne transporte que leurs références.
 *
 * Archive construite EN MÉMOIRE : elle ne contient que du text, quelques
 * centaines de kilo-bytes même avec des centaines d'articles. Un feed
 * compliquerait le code sans rien apporter — les files lourds, eux, ne
 * sont pas dedans.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'tech')

  const archive = await buildExport()
  const day = new Date().toISOString().slice(0, 10)
  const root = `export-${day}`

  // Les tags de chaque article, pour le front-matter des .md.
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
    tags: archive.liaisonsTags,
    social: archive.liaisonsSocial,
  })
  add('data/social_accounts.json', archive.socialAccounts)
  add('data/social_posts.json', archive.socialPosts)
  add('data/settings.json', archive.settings)
  add('data/users.json', archive.users)
  add('data/views.json', archive.views)
  // Les clés R2 et les dimensions, pas les bytes.
  add('media/manifest.json', archive.media)

  for (const a of archive.articles as Record<string, unknown>[]) {
    const tags = links.filter((l) => l.articleId === a.id).map((l) => l.label)
    add(`articles/${a.slug}.md`, articleToMarkdown(a, tags))
  }

  // README dans l'archive : dans two ans, personne ne se souviendra de ce
  // que contient chaque folder.
  add(
    'LISEZ-MOI.txt',
    `Export de unmaxdinfo.fr — ${archive.manifest.exporteLe}
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
