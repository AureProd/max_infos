import { eq, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as s from '../../server/database/schema'
import { type BaseDeTest, base, connexion, migrer, refuseParLaContrainte } from '../setup/db'

/**
 * Le schéma, sur une VRAIE base PostgreSQL.
 *
 * Ces tests ne vérifient pas que Drizzle sait écrire du SQL : ils
 * vérifient que les garde-fous du modèle de données protègent réellement,
 * c'est-à-dire qu'ils REFUSENT ce qui doit l'être. Une contrainte qu'on
 * n'a jamais vue échouer n'est pas une contrainte, c'est un commentaire.
 */

let sqlClient: postgres.Sql
let db: BaseDeTest

beforeAll(async () => {
  sqlClient = connexion()
  await migrer(sqlClient)
  db = base(sqlClient)
}, 60_000)

afterAll(async () => {
  await sqlClient?.end()
})

beforeEach(async () => {
  await sqlClient.unsafe(`truncate table
    article_view, article_social_post, article_tag, social_post,
    article, tag, media, setting, secret, app_user, social_account
    restart identity cascade`)
})

describe('schéma', () => {
  it('crée les onze tables du plan', async () => {
    const lignes = await sqlClient<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename`
    expect(lignes.map((l) => l.tablename)).toEqual([
      'app_user',
      'article',
      'article_social_post',
      'article_tag',
      'article_view',
      'media',
      'secret',
      'setting',
      'social_account',
      'social_post',
      'tag',
    ])
  })

  it('refuse un statut hors de la liste', async () => {
    await refuseParLaContrainte(
      () =>
        sqlClient.unsafe(
          `insert into article (slug, title, status) values ('x', 'X', 'brouillon')`,
        ),
      'article_status',
    )
  })

  it('refuse un article publié sans date de publication', async () => {
    // L'incohérence que rien d'autre ne rattraperait : ni le flux RSS, ni
    // le tri, ni le sitemap ne sauraient quoi en faire.
    await refuseParLaContrainte(
      () =>
        sqlClient.unsafe(
          `insert into article (slug, title, status) values ('x', 'X', 'published')`,
        ),
      'article_published_coherent',
    )
  })

  it('accepte un article publié daté', async () => {
    const [a] = await db
      .insert(s.article)
      .values({ slug: 'fifa', title: 'FIFA', status: 'published', publishedAt: new Date() })
      .returning()
    expect(a?.slug).toBe('fifa')
  })

  it('impose un slug unique', async () => {
    await db.insert(s.article).values({ slug: 'doublon', title: 'A' })
    await refuseParLaContrainte(
      () => db.insert(s.article).values({ slug: 'doublon', title: 'B' }),
      'uq_article_slug',
    )
  })

  it('rend la liste blanche insensible à la casse', async () => {
    // Google renvoie les adresses avec une casse variable : sans index
    // d'expression, « Max@… » créerait un second compte.
    await db.insert(s.appUser).values({ email: 'max@exemple.fr', role: 'editor' })
    await refuseParLaContrainte(
      () => db.insert(s.appUser).values({ email: 'Max@Exemple.FR', role: 'editor' }),
      'uq_app_user_email',
    )
  })

  it('supprime les liaisons en cascade, jamais les publications', async () => {
    const [a] = await db.insert(s.article).values({ slug: 'a', title: 'A' }).returning()
    const [p] = await db
      .insert(s.socialPost)
      .values({ network: 'instagram', externalId: '42', source: 'api' })
      .returning()
    await db.insert(s.articleSocialPost).values({ articleId: a!.id, socialPostId: p!.id })

    await db.delete(s.article)

    // La liaison part avec l'article…
    expect(await db.select().from(s.articleSocialPost)).toHaveLength(0)
    // …mais la publication Instagram reste : elle existe indépendamment.
    expect(await db.select().from(s.socialPost)).toHaveLength(1)
  })

  it('rend la synchronisation Instagram idempotente', async () => {
    // C'est la contrainte qui permet au worker de rejouer une synchro sans
    // dupliquer : deuxième passage = mise à jour, pas insertion.
    const valeurs = { network: 'instagram' as const, externalId: '1770', source: 'api' as const }
    await db.insert(s.socialPost).values({ ...valeurs, caption: 'première version' })
    await db
      .insert(s.socialPost)
      .values({ ...valeurs, caption: 'légende corrigée' })
      .onConflictDoUpdate({
        target: [s.socialPost.network, s.socialPost.externalId],
        set: { caption: 'légende corrigée' },
      })

    const tout = await db.select().from(s.socialPost)
    expect(tout).toHaveLength(1)
    expect(tout[0]?.caption).toBe('légende corrigée')
  })

  it('laisse coexister plusieurs LinkedIn sans identifiant externe', async () => {
    // La découverte automatique LinkedIn étant impossible, ces publications
    // sont saisies à la main et n'ont pas d'identifiant externe. Les NULL
    // étant distincts sous PostgreSQL, l'index unique ne les bloque pas.
    await db.insert(s.socialPost).values({ network: 'linkedin', url: 'https://a' })
    await db.insert(s.socialPost).values({ network: 'linkedin', url: 'https://b' })
    expect(await db.select().from(s.socialPost)).toHaveLength(2)
  })

  it('compte les vues par jour sans jamais lire avant d’écrire', async () => {
    const [a] = await db.insert(s.article).values({ slug: 'v', title: 'V' }).returning()
    const jour = '2026-09-14'
    for (let i = 0; i < 3; i++) {
      await db
        .insert(s.articleView)
        .values({ articleId: a!.id, day: jour, count: 1 })
        .onConflictDoUpdate({
          target: [s.articleView.articleId, s.articleView.day],
          set: { count: sql`${s.articleView.count} + 1` },
        })
    }
    const [vue] = await db.select().from(s.articleView)
    expect(vue?.count).toBe(3)
  })

  it('tient updated_at à jour même sur un UPDATE brut en SQL', async () => {
    // $onUpdate de Drizzle est applicatif : un script d'import qui écrit en
    // SQL direct ne le déclencherait pas. D'où le déclencheur moddatetime.
    const [a] = await db.insert(s.article).values({ slug: 'u', title: 'U' }).returning()
    const avant = a!.updatedAt
    await sqlClient.unsafe(`update article set title = 'U2' where id = ${a!.id}`)
    const [apres] = await db.select().from(s.article)
    expect(apres!.updatedAt.getTime()).toBeGreaterThan(avant.getTime())
  })

  it('refuse une portée de réglage inconnue', async () => {
    await refuseParLaContrainte(
      () =>
        sqlClient.unsafe(`insert into setting (key, value, scope) values ('x', '{}', 'secret')`),
      'setting_scope',
    )
  })

  it('refuse deux comptes du même réseau pour un même identifiant externe', async () => {
    // C'est la contrainte qui rend la reconnexion idempotente : sans elle,
    // réautoriser un compte déjà connecté en créerait un second, et l'ordre
    // comme la visibilité choisis par Max seraient perdus.
    await db.insert(s.socialAccount).values({ network: 'instagram', externalId: 'IG-9' })
    await refuseParLaContrainte(
      () => db.insert(s.socialAccount).values({ network: 'instagram', externalId: 'IG-9' }),
      'uq_social_account_network_external_id',
    )
  })

  it('déconnecter un compte emporte ses publications ET leurs rattachements', async () => {
    // La décision est assumée : déconnecter, c'est effacer. Le test existe
    // parce qu'une cascade qu'on n'a jamais vue s'exécuter n'est qu'une
    // intention.
    const [compte] = await db
      .insert(s.socialAccount)
      .values({ network: 'instagram', externalId: 'IG-A' })
      .returning()
    const [autre] = await db
      .insert(s.socialAccount)
      .values({ network: 'instagram', externalId: 'IG-B' })
      .returning()
    const [art] = await db.insert(s.article).values({ slug: 'c', title: 'C' }).returning()
    const [pub] = await db
      .insert(s.socialPost)
      .values({ network: 'instagram', externalId: 'P-A', accountId: compte!.id })
      .returning()
    await db
      .insert(s.socialPost)
      .values({ network: 'instagram', externalId: 'P-B', accountId: autre!.id })
    await db.insert(s.articleSocialPost).values({ articleId: art!.id, socialPostId: pub!.id })

    await db.delete(s.socialAccount).where(eq(s.socialAccount.id, compte!.id))

    const restantes = await db.select().from(s.socialPost)
    expect(restantes.map((p) => p.externalId)).toEqual(['P-B'])
    expect(await db.select().from(s.articleSocialPost)).toEqual([])
  })
})
