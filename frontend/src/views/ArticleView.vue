<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CoverImage from '@/components/CoverImage.vue'
import { findArticle, spinoffsOf } from '@/data/content'
import { renderMarkdown } from '@/lib/markdown'
import { frDate, nb } from '@/lib/format'
import { SITE } from '@/data/site'

const route = useRoute()
const article = computed(() => findArticle(route.params.id))
const html = computed(() => (article.value ? renderMarkdown(article.value.body) : ''))
const spinoffs = computed(() => (article.value ? spinoffsOf(article.value.id) : []))
</script>

<template>
  <div class="wrap">
    <article v-if="article" class="article">
      <RouterLink class="back" to="/">← Retour</RouterLink>

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

      <!-- eslint-disable-next-line vue/no-v-html -- corps d'article ; sera assaini côté serveur (bleach) au lot 9 -->
      <div class="prose" v-html="html" />

      <p class="endnote">
        <span>{{ nb(article.chars) }} caractères</span>
        <span v-if="spinoffs.length">{{ spinoffs.length }} déclinaison(s) courte(s)</span>
        <a :href="article.substack" target="_blank" rel="noopener">Lire sur la newsletter ↗</a>
      </p>
    </article>

    <p v-else class="empty">
      Cet article n'existe pas. <RouterLink to="/">Retour à l'accueil</RouterLink>
    </p>
  </div>
</template>
