import { date, integer, pgTable, primaryKey } from 'drizzle-orm/pg-core'
import { article } from './article'

/**
 * View counter, aggregated by day.
 *
 * No IP address, no cookie, no visitor identifier: just an integer per
 * article and per day. The increment goes through onConflictDoUpdate, which
 * avoids any prior read.
 */
export const articleView = pgTable(
  'article_view',
  {
    articleId: integer()
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    // mode 'string': a date without a time must not become a JavaScript
    // Date, which would add a time zone and therefore an offset.
    day: date({ mode: 'string' }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.day] })],
)
