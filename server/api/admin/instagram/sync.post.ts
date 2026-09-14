import { exigerRole } from '~~/server/utils/auth'
import {
  comptesInstagram,
  enregistrerCompte,
  lireJeton,
  lireMedias,
  lireProfil,
  synchroniser,
} from '~~/server/utils/instagram'

/**
 * Synchronise les publications Instagram. Rôle `editor`.
 *
 * Elle relevait du technique quand la connexion elle-même en relevait. Les
 * comptes appartiennent désormais à Max : il les connecte, il les affiche,
 * il les resynchronise. Les secrets de l'application Meta, eux, ne quittent
 * toujours pas le serveur.
 *
 * Un compte en échec — jeton expiré, quota atteint — est SIGNALÉ, il
 * n'interrompt pas les autres.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')

  const demande = Number(getQuery(event).compte)
  const tous = await comptesInstagram()
  const comptes =
    Number.isFinite(demande) && demande > 0 ? tous.filter((c) => c.id === demande) : tous

  if (comptes.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Aucun compte Instagram connecté. Passer par « Connecter un compte ».',
    })
  }

  const bilans = []
  for (const compte of comptes) {
    try {
      const jeton = await lireJeton(compte.id)
      if (!jeton) {
        bilans.push({ ...compte, vues: 0, nouvelles: 0, erreur: 'Jeton absent — reconnecter' })
        continue
      }
      const bilan = await synchroniser(await lireMedias(jeton), compte.id)
      // Le profil aussi : c'est lui qui porte le libellé et la photo de la
      // section, et il change sans prévenir.
      await enregistrerCompte(await lireProfil(jeton))
      bilans.push({ ...compte, ...bilan, erreur: null })
    } catch (e) {
      bilans.push({ ...compte, vues: 0, nouvelles: 0, erreur: (e as Error).message })
    }
  }

  setResponseStatus(event, 202)
  return {
    vues: bilans.reduce((n, b) => n + b.vues, 0),
    nouvelles: bilans.reduce((n, b) => n + b.nouvelles, 0),
    comptes: bilans,
  }
})
