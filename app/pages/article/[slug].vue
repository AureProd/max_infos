<script setup lang="ts">
import { frDate, nb } from '#shared/utils/format'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: site } = await useSite()
const { data: article, error } = await useFetch(() => `/api/articles/${slug.value}`, {
  key: () => `article-${slug.value}`,
})

/**
 * The API's 404 does NOT propagate on its own: useFetch files it under
 * `error` and renders the page with `data` at null, which would produce a
 * 200 on a non-existent article. Robots would index it as a valid page, and
 * that is precisely what the plan seeks to avoid.
 *
 * Worth knowing: Nuxt's DEVELOPMENT server serves the error page with a 200
 * regardless. The production build does answer 404 — checked by
 * test/api/seo.spec.ts, which runs against a real build. No need to « fix »
 * what you observe in development.
 */
if (error.value || !article.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'Article introuvable',
    fatal: true,
  })
}

/**
 * The publications attached to this article.
 *
 * The route existed and nothing called it: Max attached a post from the
 * back-office and it showed up on no page at all. It is also where a
 * LinkedIn post belongs — the home page no longer shows the networks it has
 * no connected account for.
 */
const { data: posts } = await useFetch('/api/social-posts', {
  key: () => `publications-${slug.value}`,
  query: { article: slug },
})

useSeoMeta({
  title: () => article.value?.seoTitle ?? article.value?.title,
  description: () => article.value?.seoDescription ?? article.value?.dek,
  ogTitle: () => article.value?.title,
  ogDescription: () => article.value?.dek,
  ogImage: () => article.value?.coverUrl,
  ogType: 'article',
  articlePublishedTime: () => article.value?.publishedAt,
  articleAuthor: () => [site.value?.identity.author ?? ''],
})

/**
 * JSON-LD Article.
 *
 * What Google and aggregators read to understand this is an article, by
 * whom and when — where the Open Graph tags only serve the sharing
 * preview. Both are needed; they do not address the same readers.
 */
// Read HERE and not in the function below: useRuntimeConfig must be called
// in the component context, not while the head is being rendered.
const baseUrl = useRuntimeConfig().public.baseUrl.replace(/\/+$/, '')

useHead({
  script: () => {
    const a = article.value
    if (!a) return []
    return [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.dek ?? undefined,
          image: a.coverUrl ?? undefined,
          datePublished: a.publishedAt ?? undefined,
          dateModified: a.publishedAt ?? undefined,
          author: {
            '@type': 'Person',
            name: site.value?.identity.author,
          },
          publisher: {
            '@type': 'Organization',
            name: site.value?.identity.name,
          },
          mainEntityOfPage: `${baseUrl}/article/${slug.value}`,
          keywords: a.tags.map((t) => t.label).join(', '),
          wordCount: Math.round(a.charCount / 6),
          inLanguage: 'fr',
        }),
      },
    ]
  },
})

// View counter: anonymous, no cookie and no IP address. Browser side only,
// otherwise every server render — including the robots' — would inflate the
// counter.
onMounted(() => {
  $fetch(`/api/articles/${slug.value}/view`, { method: 'POST' }).catch(() => {
    /* a counter is no reason to break the page */
  })
})
</script>

<template>
  <div class="wrap">
    <article v-if="article" class="article">
      <NuxtLink class="back" to="/">← Retour</NuxtLink>

      <header>
        <h1>{{ article.title }}</h1>
        <p class="dek">{{ article.dek }}</p>
        <div class="meta">
          <span class="byline">{{ site?.identity.byline }}</span>
          <time v-if="article.publishedAt" :datetime="article.publishedAt">
            le {{ frDate(article.publishedAt) }}
          </time>
          <span>{{ article.readingMinutes }} min de lecture</span>
          <span>{{ article.tags.map((t) => t.label).join(', ') }}</span>
        </div>
      </header>

      <CoverImage
        :src="article.coverUrl"
        :seed="7"
        ratio="3 / 2"
        :alt="article.coverAlt ?? article.title"
      />

      <!--
        Le corps vient de article.bodyHtml : rendu ET ASSAINI côté serveur au
        moment de l'enregistrement, jamais ici. Rien de non assaini ne peut
        entrer en base, donc rien de non assaini ne peut en sortir.
        app/pages/article/[slug].vue reste inscrit dans la liste autorisée de
        check-v-html.sh pour cette seule reason.
      -->
      <div class="prose" v-html="article.bodyHtml" />

      <!--
        Une section vide est pire que pas de section : l'en-tête ne paraît
        que s'il y a quelque chose dessous.
      -->
      <section v-if="(posts ?? []).length" class="section article-pubs">
        <div class="section-head">
          <h2>Sur les réseaux</h2>
          <span class="rule" />
        </div>
        <ul class="pubs">
          <li v-for="item in posts ?? []" :key="item.id">
            <PublicationCard :publication="item" :handle="item.accountUsername" />
          </li>
        </ul>
      </section>

      <p class="endnote">
        <span>{{ nb(article.charCount) }} caractères</span>
        <span v-if="article.variants.length">
          {{ article.variants.length }} déclinaison(s) courte(s)
        </span>
        <a v-if="article.substackUrl" :href="article.substackUrl" target="_blank" rel="noopener">
          Lire sur la newsletter ↗
        </a>
      </p>
    </article>
  </div>
</template>

<style scoped>
/*
  Les cartes ne s'étirent pas ici. `.pubs` est réglée pour l'accueil, en
  `auto-fit` : une seule publication sous un article y occupait toute la
  largeur, soit une vignette de la hauteur d'un écran. Des pistes de largeur
  FIXE gardent la carte à sa taille, quel que soit le nombre.
*/
.article-pubs {
  margin-top: 56px;
}
.article-pubs .pubs {
  grid-template-columns: repeat(auto-fill, minmax(190px, 220px));
  justify-content: start;
}
</style>
