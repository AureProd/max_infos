import { check, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { horodatage } from '../columns'
import { MEDIA_KIND, type MediaKind, uneValeurParmi } from './enums'
import { appUser } from './user'

/**
 * Images et PDF. Les fichiers eux-mêmes vivent dans Cloudflare R2 : la base
 * ne porte que la référence, ce qui est tout l'intérêt de l'externaliser —
 * l'archive d'export ne transporte alors que des clés.
 */
export const media = pgTable(
  'media',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    r2Key: text().notNull(),
    url: text().notNull(),
    mime: text().notNull(),
    width: integer(),
    height: integer(),
    bytes: integer(),
    alt: text(),
    kind: text().$type<MediaKind>().notNull().default('image'),
    // Supprimer un compte ne doit pas emporter les images qu'il a
    // téléversées : elles appartiennent au site, pas à la personne.
    uploadedBy: integer().references(() => appUser.id, { onDelete: 'set null' }),
    ...horodatage,
  },
  (t) => [
    uniqueIndex('uq_media_r2_key').on(t.r2Key),
    check('media_kind', uneValeurParmi(t.kind, MEDIA_KIND)),
  ],
)
