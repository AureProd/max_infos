import { check, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../columns'
import { MEDIA_KIND, type MediaKind, oneOf } from './enums'
import { appUser } from './user'

/**
 * Images and PDFs. The files themselves live in Cloudflare R2: the database
 * carries only the reference, which is the whole point of moving them out —
 * the export archive then carries nothing but keys.
 */
export const media = pgTable(
  'media',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    // Nullable: a medium can be referenced BEFORE being hosted in R2. That
    // is the case of covers imported from Substack, which still live on its
    // CDN and will be re-hosted in lot 5. Inventing a fake key to satisfy a
    // constraint would have made the day of the transfer impossible to tell
    // apart.
    //
    // The unique index still holds: under PostgreSQL NULLs are distinct, so
    // several media without an R2 key coexist.
    r2Key: text(),
    url: text().notNull(),
    mime: text().notNull(),
    width: integer(),
    height: integer(),
    bytes: integer(),
    alt: text(),
    kind: text().$type<MediaKind>().notNull().default('image'),
    // Deleting an account must not take the images it uploaded with it:
    // they belong to the site, not to the person.
    uploadedBy: integer().references(() => appUser.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_media_r2_key').on(t.r2Key),
    check('media_kind', oneOf(t.kind, MEDIA_KIND)),
  ],
)
