import { eq, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as s from '../../server/database/schema'
import { connection, database, migrate, rejectedByConstraint, type TestDatabase } from '../setup/db'

/**
 * The schema, on a REAL PostgreSQL database.
 *
 * These tests do not check that Drizzle can write SQL: they check that the
 * data model's guard rails really protect, that is, that they REFUSE what
 * must be refused. A constraint nobody has ever seen fail is not a
 * constraint, it is a comment.
 */

let sqlClient: postgres.Sql
let db: TestDatabase

beforeAll(async () => {
  sqlClient = connection()
  await migrate(sqlClient)
  db = database(sqlClient)
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
    const lines = await sqlClient<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename`
    expect(lines.map((l) => l.tablename)).toEqual([
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
    await rejectedByConstraint(
      () =>
        sqlClient.unsafe(
          `insert into article (slug, title, status) values ('x', 'X', 'brouillon')`,
        ),
      'article_status',
    )
  })

  it('refuse un article publié sans date de publication', async () => {
    // The inconsistency nothing else would catch: neither the RSS feed, nor
    // the ordering, nor the sitemap would know what to do with it.
    await rejectedByConstraint(
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
    await rejectedByConstraint(
      () => db.insert(s.article).values({ slug: 'doublon', title: 'B' }),
      'uq_article_slug',
    )
  })

  it('rend la liste blanche insensible à la casse', async () => {
    // Google returns addresses with varying case: without an expression
    // index, « Max@… » would create a second account.
    await db.insert(s.appUser).values({ email: 'max@exemple.fr', role: 'editor' })
    await rejectedByConstraint(
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

    // The link goes with the article…
    expect(await db.select().from(s.articleSocialPost)).toHaveLength(0)
    // …but the Instagram post stays: it exists independently.
    expect(await db.select().from(s.socialPost)).toHaveLength(1)
  })

  it('rend la synchronisation Instagram idempotente', async () => {
    // This is the constraint that lets the worker replay a sync without
    // duplicating: second pass = update, not insert.
    const values = { network: 'instagram' as const, externalId: '1770', source: 'api' as const }
    await db.insert(s.socialPost).values({ ...values, caption: 'première version' })
    await db
      .insert(s.socialPost)
      .values({ ...values, caption: 'légende corrigée' })
      .onConflictDoUpdate({
        target: [s.socialPost.network, s.socialPost.externalId],
        set: { caption: 'légende corrigée' },
      })

    const all = await db.select().from(s.socialPost)
    expect(all).toHaveLength(1)
    expect(all[0]?.caption).toBe('légende corrigée')
  })

  it('laisse coexister plusieurs LinkedIn sans identifiant externe', async () => {
    // Automatic LinkedIn discovery being impossible, these posts are
    // entered by hand and have no external identifier. NULLs being distinct
    // under PostgreSQL, the unique index does not block them.
    await db.insert(s.socialPost).values({ network: 'linkedin', url: 'https://a' })
    await db.insert(s.socialPost).values({ network: 'linkedin', url: 'https://b' })
    expect(await db.select().from(s.socialPost)).toHaveLength(2)
  })

  it('compte les vues par jour sans jamais lire avant d’écrire', async () => {
    const [a] = await db.insert(s.article).values({ slug: 'v', title: 'V' }).returning()
    const day = '2026-09-14'
    for (let i = 0; i < 3; i++) {
      await db
        .insert(s.articleView)
        .values({ articleId: a!.id, day: day, count: 1 })
        .onConflictDoUpdate({
          target: [s.articleView.articleId, s.articleView.day],
          set: { count: sql`${s.articleView.count} + 1` },
        })
    }
    const [vue] = await db.select().from(s.articleView)
    expect(vue?.count).toBe(3)
  })

  it('tient updated_at à jour même sur un UPDATE brut en SQL', async () => {
    // Drizzle's $onUpdate is application-level: an import script writing
    // raw SQL would not trigger it. Hence the moddatetime trigger.
    const [a] = await db.insert(s.article).values({ slug: 'u', title: 'U' }).returning()
    const before = a!.updatedAt
    await sqlClient.unsafe(`update article set title = 'U2' where id = ${a!.id}`)
    const [after] = await db.select().from(s.article)
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it('refuse une portée de réglage inconnue', async () => {
    await rejectedByConstraint(
      () =>
        sqlClient.unsafe(`insert into setting (key, value, scope) values ('x', '{}', 'secret')`),
      'setting_scope',
    )
  })

  it('refuse deux comptes du même réseau pour un même identifiant externe', async () => {
    // This is the constraint that makes reconnecting idempotent: without
    // it, re-authorizing an already connected account would create a second
    // one, and the order and visibility Max chose would be lost.
    await db.insert(s.socialAccount).values({ network: 'instagram', externalId: 'IG-9' })
    await rejectedByConstraint(
      () => db.insert(s.socialAccount).values({ network: 'instagram', externalId: 'IG-9' }),
      'uq_social_account_network_external_id',
    )
  })

  it('déconnecter un compte emporte ses publications ET leurs rattachements', async () => {
    // The decision is deliberate: disconnecting means erasing. The test
    // exists because a cascade nobody has ever seen run is only an
    // intention.
    const [account] = await db
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
      .values({ network: 'instagram', externalId: 'P-A', accountId: account!.id })
      .returning()
    await db
      .insert(s.socialPost)
      .values({ network: 'instagram', externalId: 'P-B', accountId: autre!.id })
    await db.insert(s.articleSocialPost).values({ articleId: art!.id, socialPostId: pub!.id })

    await db.delete(s.socialAccount).where(eq(s.socialAccount.id, account!.id))

    const remaining = await db.select().from(s.socialPost)
    expect(remaining.map((p) => p.externalId)).toEqual(['P-B'])
    expect(await db.select().from(s.articleSocialPost)).toEqual([])
  })
})
