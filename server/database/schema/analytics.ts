import { date, integer, pgTable, primaryKey } from 'drizzle-orm/pg-core'
import { article } from './article'

/**
 * Compteur de vues, agrégé par jour.
 *
 * Aucune adresse IP, aucun cookie, aucun identifiant de visiteur : juste un
 * entier par article et par jour. L'incrément se fait par
 * onConflictDoUpdate, ce qui évite toute lecture préalable.
 */
export const articleView = pgTable(
  'article_view',
  {
    articleId: integer()
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    // mode 'string' : une date sans heure ne doit pas devenir un Date
    // JavaScript, qui y ajouterait un fuseau et donc un décalage.
    day: date({ mode: 'string' }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.day] })],
)
