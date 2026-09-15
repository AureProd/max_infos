import { uploadRequest } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { allowedType, keyOf, kindOf, publicUrl, uploadUrl } from '~~/server/utils/storage'

/**
 * Prepares an upload: records the medium and returns a signed URL.
 *
 * The row is created BEFORE the transfer. A file uploaded without a row
 * would be invisible and impossible to clean up; a row without a file is
 * easy to spot and delete. We prefer the second failure to the first.
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
