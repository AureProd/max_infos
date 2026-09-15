import {
  instagramAccounts,
  readMedia,
  readProfile,
  readToken,
  refreshToken,
  saveAccount,
  saveToken,
  syncPosts,
} from '~~/server/utils/instagram'

/**
 * Tâches planifiées : synchronisation Instagram et rafraîchissement du token.
 *
 * Un plugin conditionné par `schedulerEnabled`, et NON `nitro.scheduledTasks`.
 * La raison est concrète : le dédoublonnage des tâches Nitro se fait PAR
 * INSTANCE de serveur. Avec two répliques et des tâches activées au build,
 * Instagram serait synchronisé two fois par hour, et le quota Meta
 * consommé pour rien.
 *
 * Ici l'interrupteur est une variable d'environnement : extraire un day un
 * conteneur « worker » se fera avec la MÊME image, en posant
 * NUXT_SCHEDULER_ENABLED=true sur lui seul.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.schedulerEnabled) return

  const interval = Math.max(5, config.instagramSyncIntervalMinutes) * 60_000

  console.info(
    `[planificateur] actif — synchronisation Instagram toutes les ${interval / 60_000} min`,
  )

  /**
   * Chaque account est traité SÉPARÉMENT, échec compris.
   *
   * Un token expiré sur un account ne doit pas priver les autres de leur
   * synchronisation : l'error est journalisée, la boucle continue.
   */
  const syncTask = async (): Promise<void> => {
    for (const account of await instagramAccounts()) {
      try {
        const token = await readToken(account.id)
        if (!token) continue
        const summary = await syncPosts(await readMedia(token), account.id)
        if (summary.fresh > 0) {
          console.info(`[instagram] @${account.username} : ${summary.fresh} nouvelle(s)`)
        }
        await saveAccount(await readProfile(token))
      } catch (e) {
        // Une synchronisation en échec ne doit pas arrêter le serveur : la
        // next retentera dans une hour.
        console.error(`[instagram] @${account.username} en échec :`, (e as Error).message)
      }
    }
  }

  /**
   * Rafraîchissement quotidien des tokens.
   *
   * À faire AVANT l'expiration : passé les 60 jours, un token ne se
   * rafraîchit plus et il faut refaire l'OAuth à la main. Quotidien laisse
   * donc soixante occasions de réussir.
   */
  const refresh = async (): Promise<void> => {
    for (const account of await instagramAccounts()) {
      try {
        const token = await readToken(account.id)
        if (!token) continue
        const { access_token } = await refreshToken(token)
        await saveToken(account.id, access_token)
        console.info(`[instagram] jeton de @${account.username} rafraîchi`)
      } catch (e) {
        console.error(
          `[instagram] rafraîchissement de @${account.username} en échec :`,
          (e as Error).message,
        )
      }
    }
  }

  setInterval(syncTask, interval)
  setInterval(refresh, 24 * 60 * 60_000)
})
