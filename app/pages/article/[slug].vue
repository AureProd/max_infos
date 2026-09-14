<script setup lang="ts">
import { frDate, nb } from '#shared/utils/format'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: site } = await useSite()
// Le 404 vient du serveur : useFetch le propage, la page n'a rien à
// vérifier elle-même et les robots reçoivent le bon code.
const { data: article } = await useFetch(() => `/api/articles/${slug.value}`, {
  key: () => `article-${slug.value}`,
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
 * Ce que lisent Google et les agrégateurs pour comprendre qu'il s'agit d'un
 * article, de qui et de quand — là où les balises Open Graph ne servent
 * qu'à l'aperçu de partage. Les deux sont nécessaires, ils ne s'adressent
 * pas aux mêmes lecteurs.
 */
// Lu ICI et non dans la fonction ci-dessous : useRuntimeConfig doit être
// appelé dans le contexte du composant, pas au moment du rendu de l'entête.
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

// Compteur de vues : anonyme, sans cookie ni adresse IP. Uniquement côté
// navigateur, sinon chaque rendu serveur — y compris ceux des robots —
// gonflerait le compteur.
onMounted(() => {
  $fetch(`/api/articles/${slug.value}/view`, { method: 'POST' }).catch(() => {
    /* un compteur n'est pas une raison de casser la page */
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
        ratio="4 / 5"
        :alt="article.coverAlt ?? article.title"
      />

      <!--
        Le corps vient de article.bodyHtml : rendu ET ASSAINI côté serveur au
        moment de l'enregistrement, jamais ici. Rien de non assaini ne peut
        entrer en base, donc rien de non assaini ne peut en sortir.
        app/pages/article/[slug].vue reste inscrit dans la liste autorisée de
        check-v-html.sh pour cette seule raison.
      -->
      <div class="prose" v-html="article.bodyHtml" />

      <p class="endnote">
        <span>{{ nb(article.charCount) }} caractères</span>
        <span v-if="article.declinaisons.length">
          {{ article.declinaisons.length }} déclinaison(s) courte(s)
        </span>
        <a v-if="article.substackUrl" :href="article.substackUrl" target="_blank" rel="noopener">
          Lire sur la newsletter ↗
        </a>
      </p>
    </article>
  </div>
</template>
