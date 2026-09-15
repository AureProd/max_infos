import { z } from 'zod'
import { requireRole } from '~~/server/utils/auth'
import { type Archive, applyImport, buildExport } from '~~/server/utils/export'

const importBody = z.object({
  archive: z.record(z.string(), z.unknown()),
  /** Empties the tables before writing. Without it, we add to what is there. */
  wipe: z.boolean().default(false),
  /** Writes nothing: returns what WOULD be done. */
  dryRun: z.boolean().default(false),
})

/**
 * Re-imports an archive. Role `tech`.
 *
 * `dryRun` shows the difference before writing. It is the default of the
 * command line: re-importing is not an operation you run twice out of
 * curiosity.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'tech')
  const { archive, wipe, dryRun } = await readValidatedBody(event, importBody.parse)

  const a = archive as unknown as Archive

  if (dryRun) {
    const current = await buildExport()
    return {
      dryRun: true as const,
      before: current.manifest.counts,
      after: a.manifest?.counts ?? {},
      wouldWipe: wipe,
    }
  }

  try {
    const written = await applyImport(a, { wipe })
    return { dryRun: false as const, written }
  } catch (error) {
    // An import failing with a silent 500 is useless: the operator needs to
    // know WHAT blocked, to decide whether to retry, fix the archive, or
    // restore some other way.
    const message = error instanceof Error ? error.message : String(error)
    console.error('[import] échec :', message)
    throw createError({ statusCode: 422, statusMessage: `Import impossible : ${message}` })
  }
})
