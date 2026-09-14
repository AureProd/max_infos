<script setup lang="ts">
import { frDate, nb } from '#shared/utils/format'
import { renderMarkdown } from '#shared/utils/markdown'
import { findArticle, spinoffsOf } from '~/data/content'
import { SITE } from '~/data/site'

const route = useRoute()
const article = computed(() => findArticle(String(route.params.slug)))
const html = computed(() => (article.value ? renderMarkdown(article.value.body) : ''))
const spinoffs = computed(() => (article.value ? spinoffsOf(article.value.id) : []))

// Un article inexistant doit répondre 404, pas 200 avec un message : c'est
// ce que lisent les robots d'indexation.
if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
}

useSeoMeta({
  title: () => article.value?.title,
  description: () => article.value?.dek,
  ogTitle: () => article.value?.title,
  ogDescription: () => article.value?.dek,
  ogImage: () => article.value?.cover,
  ogType: 'article',
  articlePublishedTime: () => article.value?.date,
  articleAuthor: [SITE.author],
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
          <span class="byline">{{ SITE.byline }}</span>
          <time :datetime="article.date">le {{ frDate(article.date) }}</time>
          <span>{{ article.minutes }} min de lecture</span>
          <span>{{ article.tags.join(', ') }}</span>
        </div>
      </header>

      <CoverImage :src="article.cover" :seed="7" ratio="4 / 5" :alt="article.title" />

      <!--
        v-html du corps de l'article. Le moteur de shared/utils/markdown.ts
        échappe le HTML du texte et neutralise les cibles de lien
        dangereuses. Disparaît au lot 5, quand le rendu sera assaini côté
        serveur à l'enregistrement et stocké dans article.body_html.
      -->
      <div class="prose" v-html="html" />

      <p class="endnote">
        <span>{{ nb(article.chars) }} caractères</span>
        <span v-if="spinoffs.length">{{ spinoffs.length }} déclinaison(s) courte(s)</span>
        <a :href="article.substack" target="_blank" rel="noopener">Lire sur la newsletter ↗</a>
      </p>
    </article>
  </div>
</template>
