import {
  comptesInstagram,
  enregistrerCompte,
  enregistrerJeton,
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

  /**
   * Chaque compte est traité SÉPARÉMENT, échec compris.
   *
   * Un jeton expiré sur un compte ne doit pas priver les autres de leur
   * synchronisation : l'erreur est journalisée, la boucle continue.
   */
  const synchro = async (): Promise<void> => {
    for (const compte of await comptesInstagram()) {
      try {
        const jeton = await lireJeton(compte.id)
        if (!jeton) continue
        const bilan = await synchroniser(await lireMedias(jeton), compte.id)
        if (bilan.nouvelles > 0) {
          console.info(`[instagram] @${compte.username} : ${bilan.nouvelles} nouvelle(s)`)
        }
        await enregistrerCompte(await lireProfil(jeton))
      } catch (e) {
        // Une synchronisation en échec ne doit pas arrêter le serveur : la
        // suivante retentera dans une heure.
        console.error(`[instagram] @${compte.username} en échec :`, (e as Error).message)
      }
    }
  }

  /**
   * Rafraîchissement quotidien des jetons.
   *
   * À faire AVANT l'expiration : passé les 60 jours, un jeton ne se
   * rafraîchit plus et il faut refaire l'OAuth à la main. Quotidien laisse
   * donc soixante occasions de réussir.
   */
  const rafraichir = async (): Promise<void> => {
    for (const compte of await comptesInstagram()) {
      try {
        const jeton = await lireJeton(compte.id)
        if (!jeton) continue
        const { access_token } = await rafraichirJeton(jeton)
        await enregistrerJeton(compte.id, access_token)
        console.info(`[instagram] jeton de @${compte.username} rafraîchi`)
      } catch (e) {
        console.error(
          `[instagram] rafraîchissement de @${compte.username} en échec :`,
          (e as Error).message,
        )
      }
    }
  }

  setInterval(synchro, intervalle)
  setInterval(rafraichir, 24 * 60 * 60_000)
})
