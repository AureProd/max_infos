import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { horodatage } from '../columns'
import { USER_ROLE, type UserRole, uneValeurParmi } from './enums'

/**
 * Les comptes autorisés. Liste blanche : personne ne se crée de compte,
 * c'est JB qui inscrit une adresse.
 *
 * Deux rôles aux pouvoirs opposés : `tech` (JB) voit l'infrastructure,
 * `editor` (Max) ne doit JAMAIS voir un champ technique.
 */
export const appUser = pgTable(
  'app_user',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    email: text().notNull(),
    name: text(),
    avatarUrl: text(),
    role: text().$type<UserRole>().notNull().default('editor'),
    active: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...horodatage,
  },
  (t) => [
    // Index d'EXPRESSION, et non index simple : Google renvoie les adresses
    // avec une casse variable, et la liste blanche doit y être insensible.
    // Sans cela, « Max@gmail.com » créerait un second compte.
    uniqueIndex('uq_app_user_email').on(sql`lower(${t.email})`),
    check('app_user_role', uneValeurParmi(t.role, USER_ROLE)),
  ],
)
