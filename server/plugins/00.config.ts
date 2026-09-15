import { parseConfig } from '#shared/schemas/config'

/**
 * Valide la configuration au démarrage du serveur.
 *
 * Le préfixe « 00. » garantit l'ordre : les plugins Nitro sont chargés par
 * ordre alphabétique, et rien d'autre ne doit s'exécuter before ce contrôle.
 *
 * En production, un secret manquant fait échouer le démarrage plutôt que
 * d'ouvrir un site à moitié configuré. C'est la règle posée au lot 1 et
 * reconduite telle quelle.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  parseConfig(config)
})
