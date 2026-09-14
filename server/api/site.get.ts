import { inArray } from 'drizzle-orm'
import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { useBase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { lireReglage } from '~~/server/utils/reglages'

/**
 * Ramasse tout ce qui ressemble à `…MediaId` dans les réglages.
 *
 * Un réglage ne stocke qu'un identifiant : sans résolution, la photo du CV
 * et le PDF téléchargeable ne sont qu'un nombre que le navigateur ne sait
 * pas afficher. Le balayage est GÉNÉRIQUE, par nom de champ, pour qu'un
 * futur `bannerMediaId` soit servi sans qu'on y repense.
 */
function identifiantsDeMedia(valeur: unknown, trouves = new Set<number>()): Set<number> {
  if (Array.isArray(valeur)) {
    for (const v of valeur) identifiantsDeMedia(v, trouves)
  } else if (valeur && typeof valeur === 'object') {
    for (const [cle, v] of Object.entries(valeur)) {
      if (cle.endsWith('MediaId') && typeof v === 'number') trouves.add(v)
      else identifiantsDeMedia(v, trouves)
    }
  }
  return trouves
}

/**
 * Tous les réglages de portée PUBLIQUE.
 *
 * Le filtre sur `scope` est la frontière entre ce que Max règle et ce que
 * seul JB voit. Il est appliqué en SQL, et non en filtrant la réponse après
 * coup : un oubli de filtrage côté JavaScript serait invisible à la
 * relecture, alors qu'ici la requête ne ramène jamais les réglages
 * techniques.
 */
export default defineEventHandler(async () => {
  // La liste des clés publiques vient de SETTING_SCOPE, pas de ce qui se
  // trouve en base : un réglage jamais enregistré renvoie sa valeur par
  // défaut au lieu d'être absent, et le site s'affiche dès la première
  // installation.
  const publiques = SETTING_KEYS.filter((cle) => SETTING_SCOPE[cle] === 'public')

  const sortie: Record<string, unknown> = {}
  for (const cle of publiques) sortie[cle] = await lireReglage(cle)

  const ids = [...identifiantsDeMedia(sortie)]
  const fichiers = ids.length
    ? await useBase()
        .select({ id: media.id, url: media.url, alt: media.alt, mime: media.mime })
        .from(media)
        .where(inArray(media.id, ids))
    : []

  // Une table indexée par identifiant plutôt qu'une liste : la page lit
  // `medias[cv.photoMediaId]` sans avoir à chercher.
  return {
    ...sortie,
    medias: Object.fromEntries(fichiers.map((f) => [f.id, f])),
  }
})
