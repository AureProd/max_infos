import { z } from 'zod'
import { requireRole } from '~~/server/utils/auth'
import {
  type Archive,
  applyImport,
  archiveFromZip,
  buildExport,
  IMPORT_PARTS,
} from '~~/server/utils/export'

const importBody = z.object({
  archive: z.record(z.string(), z.unknown()),
  /** Empties the tables before writing. Without it, we add to what is there. */
  wipe: z.boolean().default(false),
  /** Writes nothing: returns what WOULD be done. */
  dryRun: z.boolean().default(false),
  /** Which chunks to restore. Absent means all of them. */
  parts: z.array(z.enum(IMPORT_PARTS)).optional(),
})

/** The same three, when the archive arrives as a zip and the body is bytes. */
const zipOptions = z.object({
  wipe: z.coerce.boolean().default(false),
  dryRun: z.coerce.boolean().default(false),
  parts: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined))
    .pipe(z.array(z.enum(IMPORT_PARTS)).optional()),
})

/**
 * Re-imports an archive. Role `tech`.
 *
 * Two ways in, because the site hands out a ZIP and used to accept nothing
 * but raw JSON: the backup downloaded from the Technique screen could not
 * be restored with it, which made pulling production content into a local
 * database impossible. The zip arrives as raw bytes; JSON keeps working,
 * as the command line uses it.
 *
 * `dryRun` shows the difference before writing. It is the default of the
 * command line: re-importing is not an operation you run twice out of
 * curiosity.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'tech')

  const type = getHeader(event, 'content-type') ?? ''
  const isZip = type.includes('zip') || type.includes('octet-stream')

  let a: Archive
  let wipe: boolean
  let dryRun: boolean
  let parts: readonly (typeof IMPORT_PARTS)[number][] | undefined

  if (isZip) {
    const options = await getValidatedQuery(event, zipOptions.parse)
    const body = await readRawBody(event, false)
    if (!body?.length) {
      throw createError({ statusCode: 400, statusMessage: 'Archive vide' })
    }
    a = archiveFromZip(new Uint8Array(body))
    wipe = options.wipe
    dryRun = options.dryRun
    parts = options.parts
  } else {
    const body = await readValidatedBody(event, importBody.parse)
    a = body.archive as unknown as Archive
    wipe = body.wipe
    dryRun = body.dryRun
    parts = body.parts
  }

  if (dryRun) {
    const current = await buildExport()
    return {
      dryRun: true as const,
      before: current.manifest.counts,
      after: a.manifest?.counts ?? {},
      wouldWipe: wipe,
      parts: parts ?? [...IMPORT_PARTS],
    }
  }

  try {
    const written = await applyImport(a, { wipe, parts })
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
