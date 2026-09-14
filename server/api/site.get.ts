import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { lireReglage } from '~~/server/utils/reglages'

/**
 * Tous les réglages de portée PUBLIQUE.
 *
 * Le filtre sur `scope` est la frontière entre ce que Max règle et ce que
 * seul JB voit. Il est appliqué en SQL, et non en filtrant la réponse après
 * coup : un oubli de filtrage côté JavaScript serait invisible à la
 * relecture, alors qu'ici la requête ne ramène jamais les réglages
 * techniques.
 */
export default defineEventHandler(async () => {
  // La liste des clés publiques vient de SETTING_SCOPE, pas de ce qui se
  // trouve en base : un réglage jamais enregistré renvoie sa valeur par
  // défaut au lieu d'être absent, et le site s'affiche dès la première
  // installation.
  const publiques = SETTING_KEYS.filter((cle) => SETTING_SCOPE[cle] === 'public')

  const sortie: Record<string, unknown> = {}
  for (const cle of publiques) sortie[cle] = await lireReglage(cle)
  return sortie
})
