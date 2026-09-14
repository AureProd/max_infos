/**
 * Migration one-shot du contenu de la maquette vers la base.
 *
 *   pnpm seed              écrit par-dessus l'existant (idempotent)
 *   pnpm seed --reset      vide les tables de contenu d'abord
 *
 * Idempotent par construction : chaque écriture passe par un
 * onConflictDoUpdate sur une contrainte d'unicité. Le relancer deux fois de
 * suite donne le même résultat, ce qui permet de le rejouer après un ajout
 * sans craindre les doublons.
 *
 * Ce que ce script NE migre PAS, délibérément : les publications marquées
 * `placeholder` dans posts.ts. Ce sont des emplacements de maquette dont le
 * texte dit « Colle ici le texte réel » — les écrire en base reviendrait à
 * publier du faux contenu. Seules les deux publications Instagram réelles,
 * celles qui portent un shortcode, sont reprises.
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'
import { GABARITS_PAR_DEFAUT } from '../../server/utils/gabarits'
import { rendreMarkdown } from '../../server/utils/markdown'
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

  // --- Sujets -------------------------------------------------------------
  const libelles = [...new Set(ARTICLES.flatMap((a) => a.tags))]
  const sujets = new Map<string, number>()
  for (const label of libelles) {
    const [ligne] = await db
      .insert(schema.tag)
      .values({ slug: slugify(label), label })
      .onConflictDoUpdate({ target: schema.tag.slug, set: { label } })
      .returning({ id: schema.tag.id, slug: schema.tag.slug })
    if (ligne) sujets.set(label, ligne.id)
  }
  console.log(`▸ ${sujets.size} sujets`)

  // --- Articles et leurs couvertures --------------------------------------
  for (const a of ARTICLES) {
    // La couverture vit encore sur le CDN de Substack : on enregistre son
    // URL sans clé R2, en attendant le ré-hébergement du lot 5.
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
        // Rendu par le MÊME moteur que le back-office : les articles
        // migrés sont servis exactement comme ceux écrits ensuite.
        bodyHtml: rendreMarkdown(a.body),
        status: 'published',
        publishedAt: new Date(`${a.date}T12:00:00Z`),
        coverMediaId: coverId,
        // Les valeurs du fichier sont reprises TELLES QUELLES, et non
        // recalculées : `chars` sert de graine au visuel de repli
        // (`chars % 97`), donc le recalculer changerait l'apparence des
        // cinq articles existants. Les nouveaux articles, eux, seront
        // calculés par le back-office.
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
          bodyHtml: rendreMarkdown(a.body),
          coverMediaId: coverId,
        },
      })
      .returning({ id: schema.article.id })

    if (!art) continue

    for (const label of a.tags) {
      const tagId = sujets.get(label)
      if (tagId) {
        await db
          .insert(schema.articleTag)
          .values({ articleId: art.id, tagId })
          .onConflictDoNothing()
      }
    }
  }
  console.log(`▸ ${ARTICLES.length} articles`)

  // --- Publications Instagram réelles -------------------------------------
  let liees = 0
  for (const [i, m] of IG_MEDIA.entries()) {
    const [post] = await db
      .insert(schema.socialPost)
      .values({
        network: 'instagram',
        externalId: m.shortcode,
        shortcode: m.shortcode,
        url: m.url,
        permalink: m.url,
        mediaType: m.type === 'reel' ? 'reel' : 'carousel',
        postedAt: new Date(`${m.date}T12:00:00Z`),
        // `manual` et non `api` : ces adresses ont été relevées à la main.
        // La synchronisation du lot 6 les reprendra avec source='api'.
        source: 'manual',
        position: i,
      })
      .onConflictDoUpdate({
        target: [schema.socialPost.network, schema.socialPost.externalId],
        set: { url: m.url, permalink: m.url },
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
      liees++
    }
  }
  console.log(`▸ ${IG_MEDIA.length} publications Instagram, ${liees} rattachées`)

  // --- Réglages publics ---------------------------------------------------
  const reglages: Record<string, unknown> = {
    identity: {
      name: SITE.name,
      author: SITE.author,
      byline: SITE.byline,
      tagline: SITE.tagline,
      pitch: SITE.pitch,
    },
    contact: {
      // Chaque champ porte SON PROPRE interrupteur de visibilité. Ceux qui
      // viennent de la maquette sont des liens publics par nature ; les
      // données personnelles du CV (téléphone, adresse, date de naissance)
      // arriveront masquées, comme le prévoit le plan.
      fields: SITE.links.map((l) => ({
        key: l.label.toLowerCase(),
        label: l.label,
        value: l.value,
        href: l.href,
        visible: true,
        sensible: false,
      })),
    },
    cv: { skills: SITE.skills, interests: [], languages: [], certifications: [] },
    seo: { title: SITE.name, description: SITE.tagline, imageMediaId: null },
    home: {
      sections: ['hero', 'front', 'marquee', 'articles', 'instagram', 'all'],
      featured: [],
    },
    theme: { variables: {} },
    templates: GABARITS_PAR_DEFAUT,
    instagram_public: {
      handle: SITE.instagram.handle,
      url: SITE.instagram.url,
      name: null,
      biography: null,
      avatar: null,
      followers: null,
      posts: null,
      syncAt: null,
    },
  }

  for (const [key, value] of Object.entries(reglages)) {
    await db
      .insert(schema.setting)
      // La portée vient de la table, jamais d'une valeur écrite ici.
      .values({ key, value, scope: SETTING_SCOPE[key as SettingKey] ?? 'public' })
      .onConflictDoUpdate({ target: schema.setting.key, set: { value, updatedAt: sql`now()` } })
  }
  console.log(`▸ ${Object.keys(reglages).length} réglages publics`)
}

main()
  .then(() => console.log('✔ semis terminé'))
  .catch((e) => {
    console.error('/!\\ semis en échec :', e)
    process.exitCode = 1
  })
  .finally(() => sqlClient.end())
