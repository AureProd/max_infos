import { z } from 'zod'
import { isSettingKey, SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { requireRole } from '~~/server/utils/auth'
import { writeSetting } from '~~/server/utils/settings'

/**
 * Writes a setting. The required role DEPENDS ON THE KEY.
 *
 * This is the trickiest point of the project: a single route serves
 * settings of two scopes. The check is therefore done by key, from the same
 * table as the read — adding a technical setting protects it with nothing
 * else to write.
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
