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
 * Retour d'Instagram : échange le code contre un token long, chiffré en base.
 *
 * Le rôle est exigé here AUSSI, et pas seulement à l'aller : sans cela,
 * n'importe qui connaissant l'URL pourrait y faire aboutir un code et
 * remplacer le token d'un account.
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

  // Lire le profile AVANT d'save le token : c'est lui qui dit QUEL
  // account vient d'être autorisé. Sans cette lecture, on saurait qu'un
  // account a été connecté sans savoir lequel — et reconnecter un account
  // known en créerait un doublon.
  const account = await saveAccount(await readProfile(token))
  await saveToken(account, token)

  return sendRedirect(event, '/admin/social?instagram=ok')
})
