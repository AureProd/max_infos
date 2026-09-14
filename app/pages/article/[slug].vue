<script setup lang="ts">
import { frDate, nb } from '#shared/utils/format'
import { renderMarkdown } from '#shared/utils/markdown'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: site } = await useSite()
// Le 404 vient du serveur : useFetch le propage, la page n'a rien à
// vérifier elle-même et les robots reçoivent le bon code.
const { data: article } = await useFetch(() => `/api/articles/${slug.value}`, {
  key: () => `article-${slug.value}`,
})

const html = computed(() => (article.value ? renderMarkdown(article.value.bodyMd) : ''))

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
        v-html du corps de l'article. Le moteur de shared/utils/markdown.ts
        échappe le HTML du texte et neutralise les cibles de lien
        dangereuses. Disparaît au lot 5, quand le rendu sera assaini côté
        serveur à l'enregistrement et servi depuis article.bodyHtml.
      -->
      <div class="prose" v-html="html" />

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
