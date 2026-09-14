import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { horodatage } from '../columns'
import { article } from './article'
import {
  SOCIAL_MEDIA_TYPE,
  SOCIAL_NETWORK,
  SOCIAL_SOURCE,
  type SocialMediaType,
  type SocialNetwork,
  type SocialSource,
  uneValeurParmi,
} from './enums'

export const socialPost = pgTable(
  'social_post',
  {
    id: integer().generatedAlwaysAsIdentity().primaryKey(),
    network: text().$type<SocialNetwork>().notNull(),
    // Nul pour les publications LinkedIn saisies à la main : leur
    // découverte automatique est impossible (le scope r_member_social est
    // fermé aux nouvelles applications).
    externalId: text(),
    url: text(),
    shortcode: text(),
    mediaType: text().$type<SocialMediaType>(),
    caption: text(),
    thumbnailUrl: text(),
    permalink: text(),
    postedAt: timestamp({ withTimezone: true, mode: 'date' }),
    source: text().$type<SocialSource>().notNull().default('manual'),
    hidden: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    // Charge brute renvoyée par Meta. Volontairement peu typée : elle
    // change sans prévenir, et elle n'est JAMAIS exposée publiquement.
    raw: jsonb().$type<Record<string, unknown>>(),
    ...horodatage,
  },
  (t) => [
    // LA contrainte qui rend la synchronisation Instagram idempotente : le
    // worker fait un onConflictDoUpdate dessus, si bien qu'une publication
    // déjà connue est mise à jour au lieu d'être dupliquée.
    //
    // externalId étant nul pour LinkedIn, et les NULL étant DISTINCTS sous
    // PostgreSQL, plusieurs publications LinkedIn sans identifiant externe
    // coexistent sans conflit. C'est le comportement voulu.
    uniqueIndex('uq_social_post_network_external_id').on(t.network, t.externalId),
    index('ix_social_post_posted').on(t.network, t.postedAt.desc()),
    check('social_post_network', uneValeurParmi(t.network, SOCIAL_NETWORK)),
    check('social_post_source', uneValeurParmi(t.source, SOCIAL_SOURCE)),
    check('social_post_media_type', uneValeurParmi(t.mediaType, SOCIAL_MEDIA_TYPE)),
  ],
)

/**
 * Le lien article ↔ publication, FACULTATIF DES DEUX CÔTÉS.
 *
 * Table à part, jamais une clé étrangère sur `article` : un article peut
 * n'avoir aucune déclinaison, et une publication peut exister sans article.
 */
export const articleSocialPost = pgTable(
  'article_social_post',
  {
    articleId: integer()
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    socialPostId: integer()
      .notNull()
      .references(() => socialPost.id, { onDelete: 'cascade' }),
    position: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.socialPostId] }),
    index('ix_article_social_post_social').on(t.socialPostId),
  ],
)
