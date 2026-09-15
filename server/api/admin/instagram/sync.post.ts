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
 * Synchronises the Instagram posts. Role `editor`.
 *
 * It was technical back when the connection itself was. The accounts now
 * belong to Max: he connects them, displays them, resynchronises them. The
 * Meta application secrets, for their part, still never leave the server.
 *
 * A failing account — expired token, quota reached — is REPORTED; it does
 * not interrupt the others.
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
      // The profile too: it carries the section's label and picture, and it
      // changes without warning.
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
