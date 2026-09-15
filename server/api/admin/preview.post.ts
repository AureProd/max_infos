import { previewMarkdown } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { countCharacters, readingMinutes, renderMarkdown } from '~~/server/utils/markdown'

/**
 * Preview of the rendering, through the SAME engine as saving.
 *
 * That is what guarantees what Max sees while writing is exactly what will
 * be published. A preview rendered in the browser would drift eventually.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { bodyMd } = await readValidatedBody(event, previewMarkdown.parse)

  return {
    html: renderMarkdown(bodyMd),
    charCount: countCharacters(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  }
})
