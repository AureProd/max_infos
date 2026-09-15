import { asc, eq, sql } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import {
  appUser,
  article,
  articleSocialPost,
  articleTag,
  articleView,
  media,
  setting,
  socialAccount,
  socialPost,
  tag,
} from '~~/server/database/schema'

/**
 * Export complet du site, sous shape de données.
 *
 * Ce qui N'EST PAS exporté, et c'est délibéré :
 *  - la table `secret`, qui ne contient que des tokens tiers chiffrés. Les
 *    réexporter reviendrait à sortir des identifiants d'accès d'un système
 *    pour les set dans un file qu'on va télécharger ;
 *  - les FICHIERS eux-mêmes, qui vivent dans R2. C'est all l'intérêt de
 *    l'avoir externalisé : l'archive ne transporte que des références, et
 *    reste légère.
 *
 * Version de schéma en tête : un import saura dire qu'il ne sait pas read
 * une archive plus récente, au lieu d'écrire n'importe quoi.
 */
/**
 * 2 : l'archive emporte désormais `social_account`. Sans elle, une
 * restauration sur base vierge échouerait, `social_post.account_id`
 * pointant vers des accounts inexistants.
 */
export const VERSION_SCHEMA = 2

export interface Archive {
  manifest: {
    version: number
    exporteLe: string
    comptages: Record<string, number>
  }
  articles: unknown[]
  tags: unknown[]
  liaisonsTags: unknown[]
  media: unknown[]
  socialAccounts: unknown[]
  socialPosts: unknown[]
  liaisonsSocial: unknown[]
  settings: unknown[]
  users: unknown[]
  views: unknown[]
}

export async function buildExport(): Promise<Archive> {
  const db = useDatabase()

  const [
    articles,
    tags,
    liaisonsTags,
    mediaItems,
    comptesSociaux,
    publications,
    liaisonsSocial,
    settings,
    accounts,
    views,
  ] = await Promise.all([
    db.select().from(article).orderBy(asc(article.slug)),
    db.select().from(tag).orderBy(asc(tag.slug)),
    db.select().from(articleTag),
    db.select().from(media).orderBy(asc(media.id)),
    db.select().from(socialAccount).orderBy(asc(socialAccount.id)),
    db.select().from(socialPost).orderBy(asc(socialPost.id)),
    db.select().from(articleSocialPost),
    db.select().from(setting).orderBy(asc(setting.key)),
    // Le rôle et l'adresse, pas davantage : il n'y a rien d'autre à
    // exporter d'un account, et surtout pas de quoi s'y connecter.
    db
      .select({
        email: appUser.email,
        name: appUser.name,
        role: appUser.role,
        active: appUser.active,
      })
      .from(appUser)
      .orderBy(asc(appUser.email)),
    db.select().from(articleView),
  ])

  return {
    manifest: {
      version: VERSION_SCHEMA,
      exporteLe: new Date().toISOString(),
      comptages: {
        articles: articles.length,
        tags: tags.length,
        media: mediaItems.length,
        socialAccounts: comptesSociaux.length,
        socialPosts: publications.length,
        settings: settings.length,
        users: accounts.length,
        views: views.length,
      },
    },
    articles,
    tags: tags,
    liaisonsTags,
    media: mediaItems,
    socialAccounts: comptesSociaux,
    socialPosts: publications,
    liaisonsSocial,
    settings: settings,
    users: accounts,
    views: views,
  }
}

/** Le front-matter YAML d'un article, pour la lisibilité de l'archive. */
export function articleToMarkdown(a: Record<string, unknown>, tags: string[]): string {
  const escaped = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '\\"')}"`
  return `---
slug: ${escaped(a.slug)}
title: ${escaped(a.title)}
dek: ${escaped(a.dek)}
status: ${escaped(a.status)}
publishedAt: ${escaped(a.publishedAt instanceof Date ? a.publishedAt.toISOString() : a.publishedAt)}
tags: [${tags.map(escaped).join(', ')}]
substackUrl: ${escaped(a.substackUrl)}
---

${a.bodyMd ?? ''}
`
}

/**
 * Réécrit la base à partir d'une archive.
 *
 * `secret` n'est jamais touché : un import ne doit pas pouvoir remplacer
 * les tokens d'accès aux accounts tiers.
 */
export async function applyImport(
  archive: Archive,
  options: { vider: boolean },
): Promise<Record<string, number>> {
  const db = useDatabase()

  if (archive.manifest?.version !== VERSION_SCHEMA) {
    throw createError({
      statusCode: 422,
      statusMessage: `Archive de version ${archive.manifest?.version}, attendue ${VERSION_SCHEMA}`,
    })
  }

  if (options.vider) {
    // `secret` est ABSENTE de cette list, volontairement : un import ne
    // doit pas pouvoir effacer les tokens d'accès aux accounts tiers.
    await db.execute(sql`truncate table
      article_view, article_social_post, article_tag, social_post,
      social_account, article, tag, media, setting, app_user
      restart identity cascade`)
  }

  /**
   * Les dates traversent l'archive en chaînes ISO ; Drizzle attend des
   * objets Date. Sans cette conversion, l'insertion échoue sur chaque
   * timestamps.
   */
  const DATE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'publishedAt',
    'postedAt',
    'lastLoginAt',
    'lastSyncAt',
  ])

  const replay = <T>(lines: T[]): T[] =>
    (lines ?? []).map((ligne) => {
      const copied = { ...(ligne as Record<string, unknown>) }
      for (const [key, value] of Object.entries(copied)) {
        if (DATE_FIELDS.has(key) && typeof value === 'string') copied[key] = new Date(value)
      }
      return copied as T
    })

  const written: Record<string, number> = {}

  const insert = async <T>(name: string, table: never, lines: T[]): Promise<void> => {
    if (!lines?.length) {
      written[name] = 0
      return
    }
    await db
      .insert(table)
      .values(replay(lines) as never)
      .onConflictDoNothing()
    written[name] = lines.length
  }

  // L'ordre suit les dépendances : ce qui est référencé d'abord.
  await insert('users', appUser as never, archive.users as never[])
  await insert('media', media as never, archive.media as never[])
  await insert('tags', tag as never, archive.tags as never[])
  await insert('articles', article as never, archive.articles as never[])
  // Les accounts AVANT les publications : celles-ci les référencent.
  await insert('socialAccounts', socialAccount as never, archive.socialAccounts as never[])
  await insert('socialPosts', socialPost as never, archive.socialPosts as never[])
  await insert('liaisonsTags', articleTag as never, archive.liaisonsTags as never[])
  await insert('liaisonsSocial', articleSocialPost as never, archive.liaisonsSocial as never[])
  await insert('settings', setting as never, archive.settings as never[])
  await insert('views', articleView as never, archive.views as never[])

  /**
   * Remet les séquences au-delà du plus grand identifiant importé.
   *
   * Sans cela, la prochaine création repartirait de 1 et entrerait en
   * collision avec une ligne restaurée — une panne qui n'apparaîtrait
   * qu'au first article écrit APRÈS l'import, donc longtemps après qu'on
   * ait cru l'opération réussie.
   */
  for (const table of ['article', 'tag', 'media', 'social_account', 'social_post', 'app_user']) {
    await db.execute(
      sql`select setval(
        pg_get_serial_sequence(${table}, 'id'),
        coalesce((select max(id) from ${sql.identifier(table)}), 0) + 1,
        false
      )`,
    )
  }

  return written
}

export { eq }
