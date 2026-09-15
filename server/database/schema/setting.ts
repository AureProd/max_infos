import { check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { oneOf, SETTING_SCOPE, type SettingScope } from './enums'
import { appUser } from './user'

/**
 * Tout ce que Max peut modifier sans coder : identité, contact, CV,
 * accueil, thème, référencement, templates de déclinaison. En JSON, donc
 * intégralement exportable.
 *
 * `scope` est ce qui sépare ce que Max voit de ce que seul JB voit. La
 * portée est aussi une donnée TypeScript (SETTING_SCOPE côté shared/), ce
 * qui permettra au test d'autorisations de l'énumérer plutôt que de la
 * recopier à la main.
 */
export const setting = pgTable(
  'setting',
  {
    key: text().primaryKey(),
    value: jsonb().$type<unknown>().notNull(),
    scope: text().$type<SettingScope>().notNull().default('public'),
    updatedBy: integer().references(() => appUser.id, { onDelete: 'set null' }),
    updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [check('setting_scope', oneOf(t.scope, SETTING_SCOPE))],
)

/**
 * Les tokens tiers, chiffrés (AES-256-GCM, clé en variable
 * d'environnement). Rien d'autre n'entre here.
 *
 * N'est JAMAIS exporté et n'apparaît JAMAIS dans une réponse d'API — un
 * test vérifie qu'aucune réponse ne contient le mot « ciphertext ».
 *
 * Les clés d'infrastructure (R2, base, Google) restent en variables
 * d'environnement : elles sont nécessaires AU DÉMARRAGE, donc before que la
 * base ne soit lisible.
 */
export const secret = pgTable('secret', {
  key: text().primaryKey(),
  ciphertext: text().notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
