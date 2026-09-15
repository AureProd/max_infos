import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { isAllowed } from '#shared/utils/roles'
import { requireRole } from '~~/server/utils/auth'
import { readSetting } from '~~/server/utils/settings'

/**
 * Every setting the user is allowed to see.
 *
 * Filtering goes through SETTING_SCOPE, the same data used for writing. A
 * technical setting is therefore not returned to an `editor`, and adding a
 * technical key protects it automatically.
 */
export default defineEventHandler(async (event) => {
  const u = await requireRole(event, 'editor')

  const visible = SETTING_KEYS.filter(
    (key) => SETTING_SCOPE[key] === 'public' || isAllowed(u.role, 'tech'),
  )

  const output: Record<string, unknown> = {}
  for (const key of visible) output[key] = await readSetting(key)
  return output
})
