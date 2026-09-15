import { randomBytes } from 'node:crypto'
import { requireRole } from '~~/server/utils/auth'
import { authorizationUrl, redirectUrl } from '~~/server/utils/instagram'

/**
 * Envoie vers Instagram pour autoriser un account. Rôle `editor`.
 *
 * Ouvrir l'OAuth à Max n'expose aucun secret : `instagramAppId` et
 * `instagramAppSecret` restent dans la configuration du serveur, et le token
 * obtenu repart chiffré en base. Ce qui se décide here — quels accounts le site
 * affiche — est son travail, pas celui de JB.
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

  // L'état protège du détournement : Instagram nous le rendra tel quel, et
  // le rappel refuse all code qui n'en serait pas accompagné. Il vit dans
  // un cookie éphémère plutôt qu'en base — il ne survit pas à l'échange.
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
