import { check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { oneOf, SETTING_SCOPE, type SettingScope } from './enums'
import { appUser } from './user'

/**
 * Everything Max can change without writing code: identity, contact, CV,
 * home page, theme, SEO, variant templates. As JSON, and therefore fully
 * exportable.
 *
 * `scope` is what separates what Max sees from what only JB sees. The scope
 * is also TypeScript data (SETTING_SCOPE on the shared/ side), which lets
 * the authorization test enumerate it rather than copy it by hand.
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
 * Third-party tokens, encrypted (AES-256-GCM, key in an environment
 * variable). Nothing else goes in here.
 *
 * NEVER exported and NEVER present in an API response — a test checks that
 * no response contains the word « ciphertext ».
 *
 * Infrastructure keys (R2, database, Google) stay in environment variables:
 * they are needed AT STARTUP, so before the database can be read.
 */
export const secret = pgTable('secret', {
  key: text().primaryKey(),
  ciphertext: text().notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
