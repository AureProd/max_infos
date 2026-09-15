import { requireRole } from '~~/server/utils/auth'
import {
  exchangeCode,
  extendToken,
  readProfile,
  redirectUrl,
  saveAccount,
  saveToken,
} from '~~/server/utils/instagram'

/**
 * Return from Instagram: exchanges the code for a long-lived token,
 * encrypted in the database.
 *
 * The role is required here TOO, not only on the way out: without that,
 * anyone knowing the URL could land a code on it and replace an account's
 * token.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const config = useRuntimeConfig(event)
  const q = getQuery(event)

  const expected = getCookie(event, 'ig_oauth_state')
  deleteCookie(event, 'ig_oauth_state')

  if (q.error) {
    return sendRedirect(event, `/admin/social?instagram=refus`)
  }
  if (!expected || q.state !== expected) {
    throw createError({
      statusCode: 400,
      statusMessage: "L'état de la demande ne correspond pas. Recommencer la connexion.",
    })
  }
  if (typeof q.code !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Aucun code reçu.' })
  }

  const short = await exchangeCode(
    q.code,
    config.instagramAppId,
    config.instagramAppSecret,
    redirectUrl(config.public.baseUrl),
  )
  const token = await extendToken(short, config.instagramAppSecret)

  // Read the profile BEFORE saving the token: it is what says WHICH
  // account was just authorized. Without that read, we would know an
  // account was connected without knowing which one — and reconnecting a
  // known account would create a duplicate.
  const account = await saveAccount(await readProfile(token))
  await saveToken(account, token)

  return sendRedirect(event, '/admin/social?instagram=ok')
})
