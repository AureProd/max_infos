import { exigerRole } from '~~/server/utils/auth'
import { construireExport } from '~~/server/utils/export'

/**
 * Export complet. Rôle `tech`.
 *
 * L'archive contient l'intégralité du contenu et des réglages, mais NI les
 * jetons tiers NI les fichiers eux-mêmes — ceux-ci vivent dans R2, et c'est
 * tout l'intérêt de l'avoir externalisé.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')

  const archive = await construireExport()
  const jour = new Date().toISOString().slice(0, 10)

  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="export-${jour}.json"`)
  return archive
})
