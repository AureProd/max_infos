import { check, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../columns'
import { MEDIA_KIND, type MediaKind, oneOf } from './enums'
import { appUser } from './user'

/**
 * Images et PDF. Les files eux-mêmes vivent dans Cloudflare R2 : la base
 * ne porte que la référence, ce qui est all l'intérêt de l'externaliser —
 * l'archive d'export ne transporte alors que des clés.
 */
export const media = pgTable(
  'media',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    // Nullable : un média peut être référencé AVANT d'être hébergé dans R2.
    // C'est le cas des covers importées de Substack, qui vivent again
    // sur son CDN et seront ré-hébergées au lot 5. Inventer une fausse clé
    // pour satisfaire une contrainte aurait rendered le day du transfert
    // impossible à distinguer.
    //
    // L'index unique reste valable : sous PostgreSQL les NULL sont
    // distincts, donc plusieurs médias sans clé R2 coexistent.
    r2Key: text(),
    url: text().notNull(),
    mime: text().notNull(),
    width: integer(),
    height: integer(),
    bytes: integer(),
    alt: text(),
    kind: text().$type<MediaKind>().notNull().default('image'),
    // Supprimer un account ne doit pas emporter les images qu'il a
    // téléversées : elles appartiennent au site, pas à la personne.
    uploadedBy: integer().references(() => appUser.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_media_r2_key').on(t.r2Key),
    check('media_kind', oneOf(t.kind, MEDIA_KIND)),
  ],
)
