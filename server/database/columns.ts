import { sql } from 'drizzle-orm'
import { timestamp } from 'drizzle-orm/pg-core'

/**
 * The shared timestamps, always UTC. Carries over the TimestampMixin of
 * lot 1.
 *
 * Careful: `$onUpdate` is APPLICATION-level, not SQL — an UPDATE typed by
 * hand in psql would not trigger it. Since the project plans an
 * import/export and content migration scripts, the initial migration also
 * adds a `moddatetime` trigger so the column stays true whatever happens.
 */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** SQL trigger set by the initial migration, for the record. */
export const UPDATED_AT_TRIGGER = sql`moddatetime`
