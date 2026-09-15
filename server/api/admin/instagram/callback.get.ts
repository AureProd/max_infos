import { exigerRole } from '~~/server/utils/auth'
import {
  allongerJeton,
  echangerCode,
  enregistrerCompte,
  enregistrerJeton,
  lireProfil,
  urlDeRedirection,
} from '~~/server/utils/instagram'

/**
 * Retour d'Instagram : échange le code contre un jeton long, chiffré en base.
 *
 * Le rôle est exigé ici AUSSI, et pas seulement à l'aller : sans cela,
 * n'importe qui connaissant l'URL pourrait y faire aboutir un code et
 * remplacer le jeton d'un compte.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const config = useRuntimeConfig(event)
  const q = getQuery(event)

  const attendu = getCookie(event, 'ig_oauth_state')
  deleteCookie(event, 'ig_oauth_state')

  if (q.error) {
    return sendRedirect(event, `/admin/social?instagram=refus`)
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
  const jeton = await allongerJeton(court, config.instagramAppSecret)

  // Lire le profil AVANT d'enregistrer le jeton : c'est lui qui dit QUEL
  // compte vient d'être autorisé. Sans cette lecture, on saurait qu'un
  // compte a été connecté sans savoir lequel — et reconnecter un compte
  // connu en créerait un doublon.
  const compte = await enregistrerCompte(await lireProfil(jeton))
  await enregistrerJeton(compte, jeton)

  return sendRedirect(event, '/admin/social?instagram=ok')
})
