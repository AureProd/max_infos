import { eq } from 'drizzle-orm'
import { strToU8, zipSync } from 'fflate'
import { useBase } from '~~/server/database/client'
import { articleTag, tag } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { articleEnMarkdown, construireExport } from '~~/server/utils/export'

/**
 * Export complet, sous forme d'ARCHIVE ZIP.
 *
 * Les articles y figurent DEUX FOIS : en JSON pour le réimport, et en
 * Markdown avec front-matter pour la lecture. Ce n'est pas une redondance
 * inutile — une archive qu'on ne peut ouvrir qu'avec le logiciel qui l'a
 * produite n'est pas une sauvegarde, c'est une dépendance. Les .md
 * s'ouvrent dans n'importe quel éditeur, dans dix ans.
 *
 * N'y figurent PAS : la table `secret`, et les fichiers eux-mêmes, qui
 * vivent dans R2 — l'archive ne transporte que leurs références.
 *
 * Archive construite EN MÉMOIRE : elle ne contient que du texte, quelques
 * centaines de kilo-octets même avec des centaines d'articles. Un flux
 * compliquerait le code sans rien apporter — les fichiers lourds, eux, ne
 * sont pas dedans.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')

  const archive = await construireExport()
  const jour = new Date().toISOString().slice(0, 10)
  const racine = `export-${jour}`

  // Les sujets de chaque article, pour le front-matter des .md.
  const db = useBase()
  const liaisons = await db
    .select({ articleId: articleTag.articleId, label: tag.label })
    .from(articleTag)
    .innerJoin(tag, eq(tag.id, articleTag.tagId))

  const fichiers: Record<string, Uint8Array> = {}

  const ajouter = (chemin: string, contenu: unknown): void => {
    const texte = typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 2)
    fichiers[`${racine}/${chemin}`] = strToU8(texte)
  }

  ajouter('manifest.json', archive.manifest)
  ajouter('data/articles.json', archive.articles)
  ajouter('data/tags.json', archive.tags)
  ajouter('data/links.json', {
    tags: archive.liaisonsTags,
    social: archive.liaisonsSocial,
  })
  ajouter('data/social_posts.json', archive.socialPosts)
  ajouter('data/settings.json', archive.settings)
  ajouter('data/users.json', archive.users)
  ajouter('data/views.json', archive.views)
  // Les clés R2 et les dimensions, pas les octets.
  ajouter('media/manifest.json', archive.media)

  for (const a of archive.articles as Record<string, unknown>[]) {
    const sujets = liaisons.filter((l) => l.articleId === a.id).map((l) => l.label)
    ajouter(`articles/${a.slug}.md`, articleEnMarkdown(a, sujets))
  }

  // README dans l'archive : dans deux ans, personne ne se souviendra de ce
  // que contient chaque dossier.
  ajouter(
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

  const zip = zipSync(fichiers, { level: 9 })

  setHeader(event, 'content-type', 'application/zip')
  setHeader(event, 'content-disposition', `attachment; filename="${racine}.zip"`)
  setHeader(event, 'content-length', zip.byteLength)
  return zip
})
