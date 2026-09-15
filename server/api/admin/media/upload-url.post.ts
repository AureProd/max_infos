import { uploadRequest } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { allowedType, keyOf, kindOf, publicUrl, uploadUrl } from '~~/server/utils/storage'

/**
 * Prépare un téléversement : enregistre le média et renvoie une URL signée.
 *
 * La row est créée AVANT le transfert. Un file téléversé sans row
 * serait invisible et impossible à nettoyer ; une row sans file se
 * repère et se supprime. On préfère la seconde panne à la première.
 */
export default defineEventHandler(async (event) => {
  const u = await requireRole(event, 'editor')
  const d = await readValidatedBody(event, uploadRequest.parse)

  if (!allowedType(d.contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `Type de fichier refusé : ${d.contentType}`,
    })
  }

  const key = keyOf(d.filename)
  const url = await uploadUrl(key, d.contentType)

  const [created] = await useDatabase()
    .insert(media)
    .values({
      r2Key: key,
      url: publicUrl(key),
      mime: d.contentType,
      bytes: d.bytes,
      alt: d.alt ?? null,
      kind: kindOf(d.contentType),
      uploadedBy: u.id,
    })
    .returning({ id: media.id, url: media.url })

  setResponseStatus(event, 201)
  return { media: created, uploadUrl: url }
})
