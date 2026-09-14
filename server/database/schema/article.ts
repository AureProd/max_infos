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
import { horodatage } from '../columns'
import {
  ARTICLE_SOURCE,
  ARTICLE_STATUS,
  type ArticleSource,
  type ArticleStatus,
  uneValeurParmi,
} from './enums'
import { media } from './media'

export const article = pgTable(
  'article',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    slug: text().notNull(),
    title: text().notNull(),
    dek: text(),
    bodyMd: text().notNull().default(''),
    // Rendu assaini côté serveur au moment de l'enregistrement : la lecture
    // ne coûte alors rien et le HTML servi est sûr par construction.
    bodyHtml: text().notNull().default(''),
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
    ...horodatage,
  },
  (t) => [
    uniqueIndex('uq_article_slug').on(t.slug),
    // La requête de la page d'accueil : les publiés, du plus récent au plus
    // ancien.
    index('ix_article_published').on(t.status, t.publishedAt.desc()),
    check('article_status', uneValeurParmi(t.status, ARTICLE_STATUS)),
    check('article_source', uneValeurParmi(t.source, ARTICLE_SOURCE)),
    // Un article publié SANS date de publication est une incohérence que
    // rien d'autre ne rattraperait : ni le flux RSS, ni le tri, ni le
    // sitemap ne sauraient quoi en faire.
    check(
      'article_published_coherent',
      sql`(${t.status} <> 'published') or (${t.publishedAt} is not null)`,
    ),
  ],
)

export const tag = pgTable(
  'tag',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    slug: text().notNull(),
    label: text().notNull(),
    // Une variable CSS du thème, pas une couleur en dur.
    color: text(),
    ...horodatage,
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
    // Indispensable, et c'est l'index qu'on oublie : une clé composite
    // n'indexe que son PREMIER terme, or « les articles de ce tag » attaque
    // par tag_id.
    index('ix_article_tag_tag').on(t.tagId),
  ],
)
