import { exigerRole } from '~~/server/utils/auth'
import {
  enregistrerProfil,
  lireJeton,
  lireMedias,
  lireProfil,
  synchroniser,
} from '~~/server/utils/instagram'

/**
 * Synchronise les publications Instagram. Rôle `tech` EXIGÉ.
 *
 * Relève du technique parce qu'elle consomme le quota de l'API Meta et
 * manipule le jeton. Max voit le RÉSULTAT — les publications découvertes —
 * dans son écran Publications ; il n'a pas à déclencher la synchronisation.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')

  const jeton = await lireJeton()
  if (!jeton) {
    throw createError({
      statusCode: 409,
      statusMessage: "Instagram n'est pas connecté. Passer par « Connecter Instagram ».",
    })
  }

  const medias = await lireMedias(jeton)
  const bilan = await synchroniser(medias)

  // Le profil aussi : fin des chiffres inventés de la maquette.
  try {
    await enregistrerProfil(await lireProfil(jeton))
  } catch (e) {
    // Un profil illisible ne doit pas annuler une synchronisation réussie.
    console.warn('[instagram] profil illisible :', (e as Error).message)
  }

  setResponseStatus(event, 202)
  return bilan
})
