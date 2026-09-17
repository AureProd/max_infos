import { previewMarkdown } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import {
  countCharacters,
  htmlToText,
  readingMinutes,
  sanitizeArticleHtml,
} from '~~/server/utils/markdown'

/**
 * Preview of the rendering, through the SAME engine as saving.
 *
 * That is what guarantees what Max sees while writing is exactly what will
 * be published. A preview rendered in the browser would drift eventually.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { bodyHtml } = await readValidatedBody(event, previewMarkdown.parse)

  const html = sanitizeArticleHtml(bodyHtml)
  const text = htmlToText(html)

  return {
    // Le MÊME assainissement qu'à l'enregistrement : l'aperçu ne peut donc
    // pas montrer autre chose que ce qui sera publié.
    html,
    charCount: countCharacters(text),
    readingMinutes: readingMinutes(text),
  }
})
