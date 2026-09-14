import { demandeTeleversement } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import {
  cleDe,
  genreDe,
  typeAdmis,
  urlDeTeleversement,
  urlPublique,
} from '~~/server/utils/stockage'

/**
 * Prépare un téléversement : enregistre le média et renvoie une URL signée.
 *
 * La ligne est créée AVANT le transfert. Un fichier téléversé sans ligne
 * serait invisible et impossible à nettoyer ; une ligne sans fichier se
 * repère et se supprime. On préfère la seconde panne à la première.
 */
export default defineEventHandler(async (event) => {
  const u = await exigerRole(event, 'editor')
  const d = await readValidatedBody(event, demandeTeleversement.parse)

  if (!typeAdmis(d.contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `Type de fichier refusé : ${d.contentType}`,
    })
  }

  const cle = cleDe(d.filename)
  const url = await urlDeTeleversement(cle, d.contentType)

  const [cree] = await useBase()
    .insert(media)
    .values({
      r2Key: cle,
      url: urlPublique(cle),
      mime: d.contentType,
      bytes: d.bytes,
      alt: d.alt ?? null,
      kind: genreDe(d.contentType),
      uploadedBy: u.id,
    })
    .returning({ id: media.id, url: media.url })

  setResponseStatus(event, 201)
  return { media: cree, uploadUrl: url }
})
