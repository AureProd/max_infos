import { randomBytes } from 'node:crypto'
import { exigerRole } from '~~/server/utils/auth'
import { urlAutorisation, urlDeRedirection } from '~~/server/utils/instagram'

/**
 * Envoie vers Instagram pour autoriser un compte. Rôle `editor`.
 *
 * Ouvrir l'OAuth à Max n'expose aucun secret : `instagramAppId` et
 * `instagramAppSecret` restent dans la configuration du serveur, et le jeton
 * obtenu repart chiffré en base. Ce qui se décide ici — quels comptes le site
 * affiche — est son travail, pas celui de JB.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const config = useRuntimeConfig(event)

  if (!config.instagramAppId || !config.instagramAppSecret) {
    throw createError({
      statusCode: 409,
      statusMessage: 'NUXT_INSTAGRAM_APP_ID et NUXT_INSTAGRAM_APP_SECRET ne sont pas renseignés.',
    })
  }

  // L'état protège du détournement : Instagram nous le rendra tel quel, et
  // le rappel refuse tout code qui n'en serait pas accompagné. Il vit dans
  // un cookie éphémère plutôt qu'en base — il ne survit pas à l'échange.
  const etat = randomBytes(16).toString('hex')
  setCookie(event, 'ig_oauth_state', etat, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.public.baseUrl.startsWith('https'),
    maxAge: 600,
    path: '/',
  })

  return sendRedirect(
    event,
    urlAutorisation(config.instagramAppId, urlDeRedirection(config.public.baseUrl), etat),
  )
})
