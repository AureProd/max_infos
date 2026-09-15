import { inArray } from 'drizzle-orm'
import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { useDatabase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { readSetting } from '~~/server/utils/settings'

/**
 * Ramasse all ce qui ressemble à `…MediaId` dans les réglages.
 *
 * Un réglage ne stocke qu'un identifiant : sans résolution, la photo du CV
 * et le PDF téléchargeable ne sont qu'un count que le navigateur ne sait
 * pas afficher. Le balayage est GÉNÉRIQUE, par name de field, pour qu'un
 * futur `bannerMediaId` soit servi sans qu'on y repense.
 */
function mediaIds(value: unknown, trouves = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    for (const v of value) mediaIds(v, trouves)
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key.endsWith('MediaId') && typeof v === 'number') trouves.add(v)
      else mediaIds(v, trouves)
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
 * relecture, alors qu'here la requête ne ramène jamais les réglages
 * technical.
 */
export default defineEventHandler(async () => {
  // La list des clés publicOnes vient de SETTING_SCOPE, pas de ce qui se
  // trouve en base : un réglage jamais enregistré renvoie sa value par
  // défaut au lieu d'être absent, et le site s'affiche dès la première
  // installation.
  const publicOnes = SETTING_KEYS.filter((key) => SETTING_SCOPE[key] === 'public')

  const output: Record<string, unknown> = {}
  for (const key of publicOnes) output[key] = await readSetting(key)

  const ids = [...mediaIds(output)]
  const files = ids.length
    ? await useDatabase()
        .select({ id: media.id, url: media.url, alt: media.alt, mime: media.mime })
        .from(media)
        .where(inArray(media.id, ids))
    : []

  // Une table indexée par identifiant plutôt qu'une list : la page lit
  // `mediaItems[cv.photoMediaId]` sans avoir à chercher.
  return {
    ...output,
    mediaItems: Object.fromEntries(files.map((f) => [f.id, f])),
  }
})
