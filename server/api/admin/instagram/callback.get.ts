import { exigerRole } from '~~/server/utils/auth'
import {
  allongerJeton,
  echangerCode,
  enregistrerJeton,
  urlDeRedirection,
} from '~~/server/utils/instagram'

/**
 * Retour d'Instagram : échange le code contre un jeton long, chiffré en base.
 *
 * Rôle `tech` exigé ici AUSSI, et pas seulement à l'aller : sans cela,
 * n'importe qui connaissant l'URL pourrait y faire aboutir un code et
 * remplacer le jeton du site.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')
  const config = useRuntimeConfig(event)
  const q = getQuery(event)

  const attendu = getCookie(event, 'ig_oauth_state')
  deleteCookie(event, 'ig_oauth_state')

  if (q.error) {
    return sendRedirect(event, `/redaction/technique?instagram=refus`)
  }
  if (!attendu || q.state !== attendu) {
    throw createError({
      statusCode: 400,
      statusMessage: "L'état de la demande ne correspond pas. Recommencer la connexion.",
    })
  }
  if (typeof q.code !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Aucun code reçu.' })
  }

  const court = await echangerCode(
    q.code,
    config.instagramAppId,
    config.instagramAppSecret,
    urlDeRedirection(config.public.baseUrl),
  )
  await enregistrerJeton(await allongerJeton(court, config.instagramAppSecret))

  return sendRedirect(event, '/redaction/technique?instagram=ok')
})
