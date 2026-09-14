import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { aLeDroit } from '#shared/utils/roles'
import { exigerRole } from '~~/server/utils/auth'
import { lireReglage } from '~~/server/utils/reglages'

/**
 * Tous les réglages que l'utilisateur a le droit de voir.
 *
 * Le filtrage se fait sur SETTING_SCOPE, la même donnée qui sert à écrire.
 * Un réglage technique n'est donc pas renvoyé à un `editor`, et ajouter une
 * clé technique la protège automatiquement.
 */
export default defineEventHandler(async (event) => {
  const u = await exigerRole(event, 'editor')

  const visibles = SETTING_KEYS.filter(
    (cle) => SETTING_SCOPE[cle] === 'public' || aLeDroit(u.role, 'tech'),
  )

  const sortie: Record<string, unknown> = {}
  for (const cle of visibles) sortie[cle] = await lireReglage(cle)
  return sortie
})
