import { sql } from 'drizzle-orm'
import { timestamp } from 'drizzle-orm/pg-core'

/**
 * Horodatage commun, toujours en UTC. Reprend le TimestampMixin du lot 1.
 *
 * Attention : `$onUpdate` est APPLICATIF, pas SQL — un UPDATE passé à la
 * main dans psql ne le déclencherait pas. Comme le projet prévoit un
 * import/export et des scripts de migration de content, la migration
 * initiale ajoute en plus un déclencheur `moddatetime` pour que la colonne
 * reste vraie quoi qu'il arrive.
 */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** Déclencheur SQL posé par la migration initiale, pour mémoire. */
export const UPDATED_AT_TRIGGER = sql`moddatetime`
