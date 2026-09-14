import { z } from 'zod'
import { estCleDeReglage, SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { exigerRole } from '~~/server/utils/auth'
import { ecrireReglage } from '~~/server/utils/reglages'

/**
 * Écrit un réglage. Le rôle exigé DÉPEND DE LA CLÉ.
 *
 * C'est le point le plus délicat du projet : une seule route sert des
 * réglages de deux portées. Le contrôle se fait donc par clé, à partir de
 * la même table que la lecture — ajouter un réglage technique le protège
 * sans rien écrire de plus.
 */
export default defineEventHandler(async (event) => {
  const { cle } = await getValidatedRouterParams(
    event,
    z.object({ cle: z.enum(SETTING_KEYS as [string, ...string[]]) }).parse,
  )

  if (!estCleDeReglage(cle)) {
    throw createError({ statusCode: 404, statusMessage: 'Réglage inconnu' })
  }

  const u = await exigerRole(event, SETTING_SCOPE[cle] === 'tech' ? 'tech' : 'editor')
  const corps = await readBody(event)

  return await ecrireReglage(cle, corps, u.id)
})
