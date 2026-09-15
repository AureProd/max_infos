import { randomBytes } from 'node:crypto'
import { requireRole } from '~~/server/utils/auth'
import { authorizationUrl, redirectUrl } from '~~/server/utils/instagram'

/**
 * Sends the user to Instagram to authorize an account. Role `editor`.
 *
 * Opening OAuth to Max exposes no secret: `instagramAppId` and
 * `instagramAppSecret` stay in the server configuration, and the token
 * obtained goes back encrypted into the database. What is decided here —
 * which accounts the site displays — is his job, not JB's.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const config = useRuntimeConfig(event)

  if (!config.instagramAppId || !config.instagramAppSecret) {
    throw createError({
      statusCode: 409,
      statusMessage: 'NUXT_INSTAGRAM_APP_ID et NUXT_INSTAGRAM_APP_SECRET ne sont pas renseignés.',
    })
  }

  // The state guards against hijacking: Instagram gives it back as is, and
  // the callback refuses any code not accompanied by it. It lives in an
  // ephemeral cookie rather than in the database — it does not outlive the
  // exchange.
  const state = randomBytes(16).toString('hex')
  setCookie(event, 'ig_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.public.baseUrl.startsWith('https'),
    maxAge: 600,
    path: '/',
  })

  return sendRedirect(
    event,
    authorizationUrl(config.instagramAppId, redirectUrl(config.public.baseUrl), state),
  )
})
