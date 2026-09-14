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

/**
 * Un compte de réseau social connecté.
 *
 * Il n'existait pas tant qu'il n'y en avait qu'un : le « compte Instagram »
 * se réduisait alors à un jeton dans `secret` et à un profil figé dans
 * `setting`. Plusieurs comptes en font une entité — c'est elle qui porte le
 * jeton (par sa clé), l'identité affichée et la façon dont sa section paraît
 * sur l'accueil.
 *
 * L'identité affichée (`username`, `displayName`, `biography`, `avatarUrl`,
 * les compteurs) est TOUJOURS reprise du profil Meta à la synchronisation :
 * elle ne se saisit pas à la main, et une correction faite sur Instagram
 * arrive ici toute seule.
 */
export const socialAccount = pgTable(
  'social_account',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    network: text().$type<SocialNetwork>().notNull(),
    // L'identifiant du compte chez Meta. Nullable : la reprise de l'unique
    // compte d'avant peut ne pas le connaître, la première synchronisation
    // le renseigne.
    externalId: text(),
    username: text(),
    displayName: text(),
    biography: text(),
    avatarUrl: text(),
    followers: integer(),
    mediaCount: integer(),
    /** L'interrupteur de Max : le compte est connecté, mais paraît-il ? */
    visible: boolean().notNull().default(true),
    /** L'ordre des sections sur l'accueil. */
    position: integer().notNull().default(0),
    /** Combien de publications la section montre. */
    postsOnHome: integer().notNull().default(6),
    lastSyncAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...horodatage,
  },
  (t) => [
    // La cible de l'onConflictDoUpdate de la connexion et de la synchro :
    // reconnecter un compte déjà connu doit retomber sur SA ligne, et donc
    // préserver l'ordre, la visibilité et le nombre de publications que Max
    // a choisis. Sans contrainte d'unicité, l'upsert échouerait seulement à
    // l'exécution.
    uniqueIndex('uq_social_account_network_external_id').on(t.network, t.externalId),
    check('social_account_network', uneValeurParmi(t.network, SOCIAL_NETWORK)),
  ],
)

export const socialPost = pgTable(
  'social_post',
  {
    id: integer().generatedByDefaultAsIdentity().primaryKey(),
    network: text().$type<SocialNetwork>().notNull(),
    // De quel compte vient la publication. Nul pour LinkedIn et pour les
    // saisies manuelles, qui n'en ont pas. En cascade : déconnecter un
    // compte emporte ses publications, c'est ce qui a été décidé.
    accountId: integer().references(() => socialAccount.id, { onDelete: 'cascade' }),
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
