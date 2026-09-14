import { asc, eq, sql } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import {
  appUser,
  article,
  articleSocialPost,
  articleTag,
  articleView,
  media,
  setting,
  socialPost,
  tag,
} from '~~/server/database/schema'

/**
 * Export complet du site, sous forme de données.
 *
 * Ce qui N'EST PAS exporté, et c'est délibéré :
 *  - la table `secret`, qui ne contient que des jetons tiers chiffrés. Les
 *    réexporter reviendrait à sortir des identifiants d'accès d'un système
 *    pour les poser dans un fichier qu'on va télécharger ;
 *  - les FICHIERS eux-mêmes, qui vivent dans R2. C'est tout l'intérêt de
 *    l'avoir externalisé : l'archive ne transporte que des références, et
 *    reste légère.
 *
 * Version de schéma en tête : un import saura dire qu'il ne sait pas lire
 * une archive plus récente, au lieu d'écrire n'importe quoi.
 */
export const VERSION_SCHEMA = 1

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
  socialPosts: unknown[]
  liaisonsSocial: unknown[]
  settings: unknown[]
  users: unknown[]
  views: unknown[]
}

export async function construireExport(): Promise<Archive> {
  const db = useBase()

  const [
    articles,
    sujets,
    liaisonsTags,
    medias,
    publications,
    liaisonsSocial,
    reglages,
    comptes,
    vues,
  ] = await Promise.all([
    db.select().from(article).orderBy(asc(article.slug)),
    db.select().from(tag).orderBy(asc(tag.slug)),
    db.select().from(articleTag),
    db.select().from(media).orderBy(asc(media.id)),
    db.select().from(socialPost).orderBy(asc(socialPost.id)),
    db.select().from(articleSocialPost),
    db.select().from(setting).orderBy(asc(setting.key)),
    // Le rôle et l'adresse, pas davantage : il n'y a rien d'autre à
    // exporter d'un compte, et surtout pas de quoi s'y connecter.
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
        tags: sujets.length,
        media: medias.length,
        socialPosts: publications.length,
        settings: reglages.length,
        users: comptes.length,
        views: vues.length,
      },
    },
    articles,
    tags: sujets,
    liaisonsTags,
    media: medias,
    socialPosts: publications,
    liaisonsSocial,
    settings: reglages,
    users: comptes,
    views: vues,
  }
}

/** Le front-matter YAML d'un article, pour la lisibilité de l'archive. */
export function articleEnMarkdown(a: Record<string, unknown>, sujets: string[]): string {
  const echappe = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '\\"')}"`
  return `---
slug: ${echappe(a.slug)}
title: ${echappe(a.title)}
dek: ${echappe(a.dek)}
status: ${echappe(a.status)}
publishedAt: ${echappe(a.publishedAt instanceof Date ? a.publishedAt.toISOString() : a.publishedAt)}
tags: [${sujets.map(echappe).join(', ')}]
substackUrl: ${echappe(a.substackUrl)}
---

${a.bodyMd ?? ''}
`
}

/**
 * Réécrit la base à partir d'une archive.
 *
 * `secret` n'est jamais touché : un import ne doit pas pouvoir remplacer
 * les jetons d'accès aux comptes tiers.
 */
export async function appliquerImport(
  archive: Archive,
  options: { vider: boolean },
): Promise<Record<string, number>> {
  const db = useBase()

  if (archive.manifest?.version !== VERSION_SCHEMA) {
    throw createError({
      statusCode: 422,
      statusMessage: `Archive de version ${archive.manifest?.version}, attendue ${VERSION_SCHEMA}`,
    })
  }

  if (options.vider) {
    // `secret` est ABSENTE de cette liste, volontairement : un import ne
    // doit pas pouvoir effacer les jetons d'accès aux comptes tiers.
    await db.execute(sql`truncate table
      article_view, article_social_post, article_tag, social_post,
      article, tag, media, setting, app_user
      restart identity cascade`)
  }

  /**
   * Les dates traversent l'archive en chaînes ISO ; Drizzle attend des
   * objets Date. Sans cette conversion, l'insertion échoue sur chaque
   * horodatage.
   */
  const CHAMPS_DATE = new Set(['createdAt', 'updatedAt', 'publishedAt', 'postedAt', 'lastLoginAt'])

  const revivre = <T>(lignes: T[]): T[] =>
    (lignes ?? []).map((ligne) => {
      const copie = { ...(ligne as Record<string, unknown>) }
      for (const [cle, valeur] of Object.entries(copie)) {
        if (CHAMPS_DATE.has(cle) && typeof valeur === 'string') copie[cle] = new Date(valeur)
      }
      return copie as T
    })

  const ecrits: Record<string, number> = {}

  const inserer = async <T>(nom: string, table: never, lignes: T[]): Promise<void> => {
    if (!lignes?.length) {
      ecrits[nom] = 0
      return
    }
    await db
      .insert(table)
      .values(revivre(lignes) as never)
      .onConflictDoNothing()
    ecrits[nom] = lignes.length
  }

  // L'ordre suit les dépendances : ce qui est référencé d'abord.
  await inserer('users', appUser as never, archive.users as never[])
  await inserer('media', media as never, archive.media as never[])
  await inserer('tags', tag as never, archive.tags as never[])
  await inserer('articles', article as never, archive.articles as never[])
  await inserer('socialPosts', socialPost as never, archive.socialPosts as never[])
  await inserer('liaisonsTags', articleTag as never, archive.liaisonsTags as never[])
  await inserer('liaisonsSocial', articleSocialPost as never, archive.liaisonsSocial as never[])
  await inserer('settings', setting as never, archive.settings as never[])
  await inserer('views', articleView as never, archive.views as never[])

  /**
   * Remet les séquences au-delà du plus grand identifiant importé.
   *
   * Sans cela, la prochaine création repartirait de 1 et entrerait en
   * collision avec une ligne restaurée — une panne qui n'apparaîtrait
   * qu'au premier article écrit APRÈS l'import, donc longtemps après qu'on
   * ait cru l'opération réussie.
   */
  for (const table of ['article', 'tag', 'media', 'social_post', 'app_user']) {
    await db.execute(
      sql`select setval(
        pg_get_serial_sequence(${table}, 'id'),
        coalesce((select max(id) from ${sql.identifier(table)}), 0) + 1,
        false
      )`,
    )
  }

  return ecrits
}

export { eq }
