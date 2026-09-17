import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../columns'
import { oneOf, USER_ROLE, type UserRole } from './enums'

/**
 * The authorized accounts. An allow list: nobody signs themselves up, JB
 * adds an address.
 *
 * Two roles with opposite powers: `developer` (JB) sees the infrastructure,
 * `editor` (Max) must NEVER see a technical field. The column also still
 * accepts `tech`, the former name of `developer` — see STORED_ROLES.
 */
export const appUser = pgTable(
  'app_user',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    email: text().notNull(),
    name: text(),
    avatarUrl: text(),
    role: text().$type<UserRole | 'tech'>().notNull().default('editor'),
    active: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    // An EXPRESSION index, not a plain one: Google returns addresses with
    // varying case, and the allow list must be insensitive to it. Without
    // this, « Max@gmail.com » would create a second account.
    uniqueIndex('uq_app_user_email').on(sql`lower(${t.email})`),
    check('app_user_role', oneOf(t.role, USER_ROLE)),
  ],
)
