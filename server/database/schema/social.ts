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
import { timestamps } from '../columns'
import { article } from './article'
import {
  oneOf,
  SOCIAL_MEDIA_TYPE,
  SOCIAL_NETWORK,
  SOCIAL_SOURCE,
  type SocialMediaType,
  type SocialNetwork,
  type SocialSource,
} from './enums'

/**
 * A connected social network account.
 *
 * It did not exist as long as there was only one: the « Instagram account »
 * was then just a token in `secret` and a frozen profile in `setting`.
 * Several accounts make it an entity — one that carries the token (through
 * its key), the displayed identity, and how its section appears on the home
 * page.
 *
 * The displayed identity (`username`, `displayName`, `biography`,
 * `avatarUrl`, the counters) is ALWAYS taken from the Meta profile at sync
 * time: it is not typed in by hand, and a correction made on Instagram
 * arrives here on its own.
 */
export const socialAccount = pgTable(
  'social_account',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    network: text().$type<SocialNetwork>().notNull(),
    // The account's identifier at Meta. Nullable: carrying over the single
    // account from before may not know it, the first sync fills it in.
    externalId: text(),
    username: text(),
    displayName: text(),
    biography: text(),
    avatarUrl: text(),
    followers: integer(),
    mediaCount: integer(),
    /** Max's switch: the account is connected, but does it show? */
    visible: boolean().notNull().default(true),
    /** The order of sections on the home page. */
    position: integer().notNull().default(0),
    /** How many posts the section shows. */
    postsOnHome: integer().notNull().default(6),
    lastSyncAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    // The target of the connect and sync onConflictDoUpdate: reconnecting
    // an already known account must land on ITS row, and therefore preserve
    // the order, the visibility and the post count Max chose. Without a
    // uniqueness constraint, the upsert would only fail at runtime.
    uniqueIndex('uq_social_account_network_external_id').on(t.network, t.externalId),
    check('social_account_network', oneOf(t.network, SOCIAL_NETWORK)),
  ],
)

export const socialPost = pgTable(
  'social_post',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    network: text().$type<SocialNetwork>().notNull(),
    // Which account the post comes from. Null for LinkedIn and for manual
    // entries, which have none. On cascade: disconnecting an account takes
    // its posts with it, as decided.
    accountId: integer().references(() => socialAccount.id, { onDelete: 'cascade' }),
    // Null for LinkedIn posts entered by hand: discovering them
    // automatically is impossible (the r_member_social scope is closed to
    // new applications).
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
    // The raw payload returned by Meta. Deliberately loosely typed: it
    // changes without warning, and it is NEVER exposed publicly.
    raw: jsonb().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    // THE constraint that makes the Instagram sync idempotent: the worker
    // does an onConflictDoUpdate on it, so an already known post is updated
    // instead of duplicated.
    //
    // externalId being null for LinkedIn, and NULLs being DISTINCT under
    // PostgreSQL, several LinkedIn posts without an external identifier
    // coexist without conflict. That is the intended behaviour.
    uniqueIndex('uq_social_post_network_external_id').on(t.network, t.externalId),
    index('ix_social_post_posted').on(t.network, t.postedAt.desc()),
    check('social_post_network', oneOf(t.network, SOCIAL_NETWORK)),
    check('social_post_source', oneOf(t.source, SOCIAL_SOURCE)),
    check('social_post_media_type', oneOf(t.mediaType, SOCIAL_MEDIA_TYPE)),
  ],
)

/**
 * The article ↔ post link, OPTIONAL ON BOTH SIDES.
 *
 * A separate table, never a foreign key on `article`: an article may have
 * no variant at all, and a post may exist without an article.
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
