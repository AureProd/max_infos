import { previewMarkdown } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { countCharacters, readingMinutes, renderMarkdown } from '~~/server/utils/markdown'

/**
 * Aperçu du rendered, par le MÊME engine que l'record.
 *
 * C'est ce qui garantit que ce que Max voit en écrivant est exactement ce
 * qui sera publié. Un aperçu rendered côté navigateur finirait par diverger.
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
