import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { timestamps } from '../columns'
import {
  ARTICLE_SOURCE,
  ARTICLE_STATUS,
  type ArticleSource,
  type ArticleStatus,
  oneOf,
} from './enums'
import { media } from './media'

export const article = pgTable(
  'article',
  {
    /**
     * BY DEFAULT and not ALWAYS.
     *
     * `GENERATED ALWAYS` refuses any explicit identifier insert, which
     * makes an import impossible to restore: the link tables reference
     * these identifiers, and letting them be regenerated would break every
     * link. This is precisely the case `BY DEFAULT` exists for. Every table
     * in the schema follows this rule.
     */
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    slug: text().notNull(),
    title: text().notNull(),
    dek: text(),
    /**
     * L'ancien corps, en Markdown.
     *
     * Plus écrit depuis la bascule vers l'éditeur : `bodyHtml` est la
     * source. Conservée le temps d'un déploiement — l'ancien conteneur
     * tourne encore quand le nouveau schéma est appliqué — et retirée par
     * une migration ultérieure.
     */
    bodyMd: text().notNull().default(''),
    // Assaini côté serveur à l'enregistrement : la lecture ne coûte donc
    // rien, et le HTML servi est sûr par construction.
    bodyHtml: text().notNull().default(''),
    /**
     * Le texte brut, dérivé du corps. C'est sur lui que porte la recherche.
     *
     * Elle cherchait dans le Markdown : un article contenant
     * « **souveraineté** » ne répondait pas à « souveraineté », et les
     * extraits rendaient des `[texte](adresse)`.
     */
    bodyText: text().notNull().default(''),
    status: text().$type<ArticleStatus>().notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true, mode: 'date' }),
    coverMediaId: integer().references(() => media.id, { onDelete: 'set null' }),
    readingMinutes: integer().notNull().default(0),
    charCount: integer().notNull().default(0),
    featured: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    seoTitle: text(),
    seoDescription: text(),
    substackUrl: text(),
    source: text().$type<ArticleSource>().notNull().default('site'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('uq_article_slug').on(t.slug),
    // The home page query: the published ones, newest first.
    index('ix_article_published').on(t.status, t.publishedAt.desc()),
    check('article_status', oneOf(t.status, ARTICLE_STATUS)),
    check('article_source', oneOf(t.source, ARTICLE_SOURCE)),
    // A published article WITHOUT a publication date is an inconsistency
    // nothing else would catch: neither the RSS feed, nor the ordering, nor
    // the sitemap would know what to do with it.
    check(
      'article_published_coherent',
      sql`(${t.status} <> 'published') or (${t.publishedAt} is not null)`,
    ),
  ],
)

export const tag = pgTable(
  'tag',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    slug: text().notNull(),
    label: text().notNull(),
    // A CSS variable of the theme, not a hard-coded colour.
    color: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('uq_tag_slug').on(t.slug)],
)

export const articleTag = pgTable(
  'article_tag',
  {
    articleId: integer()
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    tagId: integer()
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.tagId] }),
    // Essential, and the index everyone forgets: a composite key only
    // indexes its FIRST term, yet « the articles of this tag » starts from
    // tag_id.
    index('ix_article_tag_tag').on(t.tagId),
  ],
)
