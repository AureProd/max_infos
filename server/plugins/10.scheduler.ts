import {
  enregistrerJeton,
  enregistrerProfil,
  lireJeton,
  lireMedias,
  lireProfil,
  rafraichirJeton,
  synchroniser,
} from '~~/server/utils/instagram'

/**
 * Tâches planifiées : synchronisation Instagram et rafraîchissement du jeton.
 *
 * Un plugin conditionné par `schedulerEnabled`, et NON `nitro.scheduledTasks`.
 * La raison est concrète : le dédoublonnage des tâches Nitro se fait PAR
 * INSTANCE de serveur. Avec deux répliques et des tâches activées au build,
 * Instagram serait synchronisé deux fois par heure, et le quota Meta
 * consommé pour rien.
 *
 * Ici l'interrupteur est une variable d'environnement : extraire un jour un
 * conteneur « worker » se fera avec la MÊME image, en posant
 * NUXT_SCHEDULER_ENABLED=true sur lui seul.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.schedulerEnabled) return

  const intervalle = Math.max(5, config.instagramSyncIntervalMinutes) * 60_000

  console.info(
    `[planificateur] actif — synchronisation Instagram toutes les ${intervalle / 60_000} min`,
  )

  const synchro = async (): Promise<void> => {
    try {
      const jeton = await lireJeton()
      if (!jeton) return
      const bilan = await synchroniser(await lireMedias(jeton))
      if (bilan.nouvelles > 0) {
        console.info(`[instagram] ${bilan.nouvelles} nouvelle(s) publication(s)`)
      }
      await enregistrerProfil(await lireProfil(jeton))
    } catch (e) {
      // Une synchronisation en échec ne doit pas arrêter le serveur : la
      // suivante retentera dans une heure.
      console.error('[instagram] synchronisation en échec :', (e as Error).message)
    }
  }

  /**
   * Rafraîchissement quotidien du jeton.
   *
   * À faire AVANT l'expiration : passé les 60 jours, un jeton ne se
   * rafraîchit plus et il faut refaire l'OAuth à la main. Quotidien laisse
   * donc soixante occasions de réussir.
   */
  const rafraichir = async (): Promise<void> => {
    try {
      const jeton = await lireJeton()
      if (!jeton) return
      const { access_token } = await rafraichirJeton(jeton)
      await enregistrerJeton(access_token)
      console.info('[instagram] jeton rafraîchi')
    } catch (e) {
      console.error('[instagram] rafraîchissement du jeton en échec :', (e as Error).message)
    }
  }

  setInterval(synchro, intervalle)
  setInterval(rafraichir, 24 * 60 * 60_000)
})
