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
 * Scheduled tasks: Instagram sync and token refresh.
 *
 * A plugin gated by `schedulerEnabled`, and NOT `nitro.scheduledTasks`. The
 * reason is concrete: Nitro deduplicates tasks PER SERVER INSTANCE. With
 * two replicas and tasks enabled at build time, Instagram would be synced
 * twice an hour, and the Meta quota spent for nothing.
 *
 * Here the switch is an environment variable: pulling out a « worker »
 * container one day will use the SAME image, setting
 * NUXT_SCHEDULER_ENABLED=true on it alone.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.schedulerEnabled) return

  const interval = Math.max(5, config.instagramSyncIntervalMinutes) * 60_000

  console.info(
    `[planificateur] actif — synchronisation Instagram toutes les ${interval / 60_000} min`,
  )

  /**
   * Each account is handled SEPARATELY, failures included.
   *
   * An expired token on one account must not deprive the others of their
   * sync: the error is logged, the loop goes on.
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
        // A failed sync must not stop the server: the next one will try
        // again in an hour.
        console.error(`[instagram] @${account.username} en échec :`, (e as Error).message)
      }
    }
  }

  /**
   * Daily token refresh.
   *
   * To be done BEFORE expiry: past the 60 days, a token cannot be refreshed
   * any more and the OAuth dance has to be redone by hand. Daily therefore
   * leaves sixty chances to succeed.
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
