import { z } from 'zod'
import { isSettingKey, SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { requireRole } from '~~/server/utils/auth'
import { writeSetting } from '~~/server/utils/settings'

/**
 * Écrit un réglage. Le rôle exigé DÉPEND DE LA CLÉ.
 *
 * C'est le point le plus délicat du projet : une seule route sert des
 * réglages de two portées. Le contrôle se fait donc par clé, à partir de
 * la même table que la lecture — add un réglage technique le protège
 * sans rien écrire de plus.
 */
export default defineEventHandler(async (event) => {
  const { key } = await getValidatedRouterParams(
    event,
    z.object({ key: z.enum(SETTING_KEYS as [string, ...string[]]) }).parse,
  )

  if (!isSettingKey(key)) {
    throw createError({ statusCode: 404, statusMessage: 'Réglage inconnu' })
  }

  const u = await requireRole(event, SETTING_SCOPE[key] === 'tech' ? 'tech' : 'editor')
  const body = await readBody(event)

  return await writeSetting(key, body, u.id)
})
