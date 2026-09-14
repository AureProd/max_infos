import { z } from 'zod'
import { exigerRole } from '~~/server/utils/auth'
import { type Archive, appliquerImport, construireExport } from '~~/server/utils/export'

const corpsImport = z.object({
  archive: z.record(z.string(), z.unknown()),
  /** Vide les tables avant d'écrire. Sans cela, on complète l'existant. */
  vider: z.boolean().default(false),
  /** N'écrit rien : renvoie ce qui SERAIT fait. */
  simulation: z.boolean().default(false),
})

/**
 * Réimporte une archive. Rôle `tech`.
 *
 * `simulation` affiche le différentiel avant d'écrire. C'est le mode par
 * défaut de la commande en ligne : réimporter est une opération qu'on ne
 * lance pas deux fois par curiosité.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'tech')
  const { archive, vider, simulation } = await readValidatedBody(event, corpsImport.parse)

  const a = archive as unknown as Archive

  if (simulation) {
    const actuel = await construireExport()
    return {
      simulation: true as const,
      avant: actuel.manifest.comptages,
      apres: a.manifest?.comptages ?? {},
      viderait: vider,
    }
  }

  try {
    const ecrits = await appliquerImport(a, { vider })
    return { simulation: false as const, ecrits }
  } catch (erreur) {
    // Un import qui échoue par un 500 muet est inutilisable : l'opérateur
    // a besoin de savoir CE QUI a bloqué pour décider s'il réessaie, s'il
    // corrige l'archive, ou s'il restaure autrement.
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    console.error('[import] échec :', message)
    throw createError({ statusCode: 422, statusMessage: `Import impossible : ${message}` })
  }
})
