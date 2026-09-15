import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { isAllowed } from '#shared/utils/roles'
import { requireRole } from '~~/server/utils/auth'
import { readSetting } from '~~/server/utils/settings'

/**
 * Tous les réglages que l'user a le droit de voir.
 *
 * Le filtrage se fait sur SETTING_SCOPE, la même donnée qui sert à écrire.
 * Un réglage technique n'est donc pas renvoyé à un `editor`, et add une
 * clé technique la protège automatiquement.
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
