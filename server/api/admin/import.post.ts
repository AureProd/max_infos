import { z } from 'zod'
import { requireRole } from '~~/server/utils/auth'
import { type Archive, applyImport, buildExport } from '~~/server/utils/export'

const importBody = z.object({
  archive: z.record(z.string(), z.unknown()),
  /** Vide les tables before d'écrire. Sans cela, on complète l'existing. */
  vider: z.boolean().default(false),
  /** N'écrit rien : renvoie ce qui SERAIT fait. */
  simulation: z.boolean().default(false),
})

/**
 * Réimporte une archive. Rôle `tech`.
 *
 * `simulation` affiche le différentiel before d'écrire. C'est le mode par
 * défaut de la commande en row : réimporter est une opération qu'on ne
 * lance pas two fois par curiosité.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'tech')
  const { archive, vider, simulation } = await readValidatedBody(event, importBody.parse)

  const a = archive as unknown as Archive

  if (simulation) {
    const actuel = await buildExport()
    return {
      simulation: true as const,
      before: actuel.manifest.comptages,
      after: a.manifest?.comptages ?? {},
      viderait: vider,
    }
  }

  try {
    const written = await applyImport(a, { vider })
    return { simulation: false as const, written }
  } catch (error) {
    // Un import qui échoue par un 500 muet est inutilisable : l'opérateur
    // a besoin de savoir CE QUI a bloqué pour décider s'il réessaie, s'il
    // corrige l'archive, ou s'il restaure autrement.
    const message = error instanceof Error ? error.message : String(error)
    console.error('[import] échec :', message)
    throw createError({ statusCode: 422, statusMessage: `Import impossible : ${message}` })
  }
})
