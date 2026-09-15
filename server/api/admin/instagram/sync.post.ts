import { requireRole } from '~~/server/utils/auth'
import {
  instagramAccounts,
  readMedia,
  readProfile,
  readToken,
  saveAccount,
  syncPosts,
} from '~~/server/utils/instagram'

/**
 * Synchronise les publications Instagram. Rôle `editor`.
 *
 * Elle relevait du technique quand la connection elle-même en relevait. Les
 * accounts appartiennent désormais à Max : il les signedIn, il les affiche,
 * il les resynchronise. Les secrets de l'application Meta, eux, ne quittent
 * toujours pas le serveur.
 *
 * Un account en échec — token expiré, quota atteint — est SIGNALÉ, il
 * n'interrompt pas les autres.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')

  const request = Number(getQuery(event).account)
  const all = await instagramAccounts()
  const accounts =
    Number.isFinite(request) && request > 0 ? all.filter((c) => c.id === request) : all

  if (accounts.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Aucun compte Instagram connecté. Passer par « Connecter un compte ».',
    })
  }

  const summaries = []
  for (const account of accounts) {
    try {
      const token = await readToken(account.id)
      if (!token) {
        summaries.push({ ...account, views: 0, fresh: 0, error: 'Jeton absent — reconnecter' })
        continue
      }
      const summary = await syncPosts(await readMedia(token), account.id)
      // Le profile aussi : c'est lui qui porte le libellé et la photo de la
      // section, et il change sans prévenir.
      await saveAccount(await readProfile(token))
      summaries.push({ ...account, ...summary, error: null })
    } catch (e) {
      summaries.push({ ...account, views: 0, fresh: 0, error: (e as Error).message })
    }
  }

  setResponseStatus(event, 202)
  return {
    views: summaries.reduce((n, b) => n + b.views, 0),
    fresh: summaries.reduce((n, b) => n + b.fresh, 0),
    accounts: summaries,
  }
})
