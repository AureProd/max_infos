/**
 * One-shot migration of the mock-up content into the database.
 *
 *   pnpm seed              writes over what is there (idempotent)
 *   pnpm seed --reset      empties the content tables first
 *
 * Idempotent by construction: every write goes through an
 * onConflictDoUpdate on a uniqueness constraint. Running it twice in a row
 * gives the same result, which allows replaying it after an addition
 * without fear of duplicates.
 *
 * What this script does NOT migrate, deliberately: the posts marked
 * `placeholder` in posts.ts. Those are mock-up slots whose text reads
 * « Paste the real text here » — writing them to the database would amount
 * to publishing wrong content. Only the two real Instagram posts, the ones
 * carrying a shortcode, are taken.
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'
import { renderMarkdown } from '../../server/utils/markdown'
import { DEFAULT_TEMPLATES } from '../../server/utils/templates'
import { SETTING_SCOPE, type SettingKey } from '../../shared/schemas/settings'
import { slugify } from '../../shared/utils/slug'
import { ARTICLES } from './data/articles'
import { IG_MEDIA } from './data/instagram'
import { SITE } from './data/site'

const URL = process.env.DATABASE_URL ?? process.env.NUXT_DATABASE_URL
if (!URL) {
  console.error('/!\\ DATABASE_URL manquante')
  process.exit(1)
}

const sqlClient = postgres(URL, { max: 1, onnotice: () => {} })
const db = drizzle(sqlClient, { schema, casing: 'snake_case' })

const reset = process.argv.includes('--reset')

async function main(): Promise<void> {
  if (reset) {
    await sqlClient.unsafe(`truncate table
      article_view, article_social_post, article_tag, social_post,
      article, tag, media, setting
      restart identity cascade`)
    console.log('▸ tables de contenu vidées')
  }

  // --- Tags -----------------------------------------------------------------
  const labels = [...new Set(ARTICLES.flatMap((a) => a.tags))]
  const tags = new Map<string, number>()
  for (const label of labels) {
    const [row] = await db
      .insert(schema.tag)
      .values({ slug: slugify(label), label })
      .onConflictDoUpdate({ target: schema.tag.slug, set: { label } })
      .returning({ id: schema.tag.id, slug: schema.tag.slug })
    if (row) tags.set(label, row.id)
  }
  console.log(`▸ ${tags.size} sujets`)

  // --- Articles and their covers --------------------------------------------
  for (const a of ARTICLES) {
    // The cover still lives on Substack's CDN: we record its URL without
    // an R2 key, pending the re-hosting of lot 5.
    let coverId: number | null = null
    if (a.cover) {
      const [m] = await db
        .insert(schema.media)
        .values({ url: a.cover, mime: 'image/png', kind: 'image', alt: a.title })
        .onConflictDoNothing()
        .returning({ id: schema.media.id })
      coverId =
        m?.id ??
        (
          await db
            .select({ id: schema.media.id })
            .from(schema.media)
            .where(eq(schema.media.url, a.cover))
            .limit(1)
        )[0]?.id ??
        null
    }

    const [art] = await db
      .insert(schema.article)
      .values({
        slug: a.id,
        title: a.title,
        dek: a.dek,
        bodyMd: a.body,
        // Rendered by the SAME engine as the back-office: migrated
        // articles are served exactly like those written later.
        bodyHtml: renderMarkdown(a.body),
        status: 'published',
        publishedAt: new Date(`${a.date}T12:00:00Z`),
        coverMediaId: coverId,
        // The file's values are taken AS THEY ARE, not recomputed:
        // `chars` seeds the fallback artwork (`chars % 97`), so
        // recomputing it would change the look of the five existing
        // articles. New articles will be computed by the back-office.
        readingMinutes: a.minutes,
        charCount: a.chars,
        substackUrl: a.substack,
        source: 'substack_import',
      })
      .onConflictDoUpdate({
        target: schema.article.slug,
        set: {
          title: a.title,
          dek: a.dek,
          bodyMd: a.body,
          bodyHtml: renderMarkdown(a.body),
          coverMediaId: coverId,
        },
      })
      .returning({ id: schema.article.id })

    if (!art) continue

    for (const label of a.tags) {
      const tagId = tags.get(label)
      if (tagId) {
        await db
          .insert(schema.articleTag)
          .values({ articleId: art.id, tagId })
          .onConflictDoNothing()
      }
    }
  }
  console.log(`▸ ${ARTICLES.length} articles`)

  // --- The mock-up's Instagram account --------------------------------------
  //
  // `externalId` carries a marker value rather than NULL: under PostgreSQL
  // two NULLs are DISTINCT, and a replayed seed would create a second
  // account instead of finding the first. The first real connection will
  // replace it with the Meta identifier.
  const [account] = await db
    .insert(schema.socialAccount)
    .values({
      network: 'instagram',
      externalId: 'maquette',
      username: SITE.instagram.handle.replace(/^@/, ''),
      followers: SITE.instagram.followers,
      mediaCount: SITE.instagram.posts,
    })
    .onConflictDoUpdate({
      target: [schema.socialAccount.network, schema.socialAccount.externalId],
      set: { username: SITE.instagram.handle.replace(/^@/, '') },
    })
    .returning({ id: schema.socialAccount.id })

  // --- Real Instagram posts -------------------------------------------------
  let linked = 0
  for (const [i, m] of IG_MEDIA.entries()) {
    const [post] = await db
      .insert(schema.socialPost)
      .values({
        network: 'instagram',
        accountId: account?.id ?? null,
        externalId: m.shortcode,
        shortcode: m.shortcode,
        url: m.url,
        permalink: m.url,
        mediaType: m.type === 'reel' ? 'reel' : 'carousel',
        postedAt: new Date(`${m.date}T12:00:00Z`),
        // `manual` and not `api`: these addresses were collected by hand.
        // The lot 6 sync will pick them up again with source='api'.
        source: 'manual',
        position: i,
      })
      .onConflictDoUpdate({
        target: [schema.socialPost.network, schema.socialPost.externalId],
        set: { url: m.url, permalink: m.url, accountId: account?.id ?? null },
      })
      .returning({ id: schema.socialPost.id })

    const [art] = await db
      .select({ id: schema.article.id })
      .from(schema.article)
      .where(eq(schema.article.slug, m.articleId))
      .limit(1)

    if (post && art) {
      await db
        .insert(schema.articleSocialPost)
        .values({ articleId: art.id, socialPostId: post.id, position: i })
        .onConflictDoNothing()
      linked++
    }
  }
  console.log(`▸ ${IG_MEDIA.length} publications Instagram, ${linked} rattachées`)

  // --- Public settings ------------------------------------------------------
  const settings: Record<string, unknown> = {
    identity: {
      name: SITE.name,
      author: SITE.author,
      byline: SITE.byline,
      tagline: SITE.tagline,
      pitch: SITE.pitch,
    },
    contact: {
      // Each field carries ITS OWN visibility switch. The ones coming from
      // the mock-up are public links by nature; the CV's personal data
      // (phone, address, date of birth) will arrive hidden, as the plan
      // provides.
      fields: SITE.links.map((l) => ({
        key: l.label.toLowerCase(),
        label: l.label,
        value: l.value,
        href: l.href,
        visible: true,
        sensitive: false,
      })),
    },
    cv: { skills: SITE.skills, interests: [], languages: [], certifications: [] },
    seo: { title: SITE.name, description: SITE.tagline, imageMediaId: null },
    templates: DEFAULT_TEMPLATES,
  }

  for (const [key, value] of Object.entries(settings)) {
    await db
      .insert(schema.setting)
      // The scope comes from the table, never from a value written here.
      .values({ key, value, scope: SETTING_SCOPE[key as SettingKey] ?? 'public' })
      .onConflictDoUpdate({ target: schema.setting.key, set: { value, updatedAt: sql`now()` } })
  }
  console.log(`▸ ${Object.keys(settings).length} réglages publics`)
}

main()
  .then(() => console.log('✔ semis terminé'))
  .catch((e) => {
    console.error('/!\\ semis en échec :', e)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
