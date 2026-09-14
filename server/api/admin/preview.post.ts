import { apercuMarkdown } from '#shared/schemas/api'
import { exigerRole } from '~~/server/utils/auth'
import { compterCaracteres, minutesDeLecture, rendreMarkdown } from '~~/server/utils/markdown'

/**
 * Aperçu du rendu, par le MÊME moteur que l'enregistrement.
 *
 * C'est ce qui garantit que ce que Max voit en écrivant est exactement ce
 * qui sera publié. Un aperçu rendu côté navigateur finirait par diverger.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { bodyMd } = await readValidatedBody(event, apercuMarkdown.parse)

  return {
    html: rendreMarkdown(bodyMd),
    charCount: compterCaracteres(bodyMd),
    readingMinutes: minutesDeLecture(bodyMd),
  }
})
