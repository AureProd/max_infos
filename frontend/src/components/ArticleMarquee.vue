<script setup>
import { ARTICLES } from '@/data/content'

/** Bandeau défilant des titres — la signature visuelle de Sphères. */
const run = [...ARTICLES, ...ARTICLES]
</script>

<template>
  <div class="marquee" aria-label="Tous les articles">
    <div class="marquee-run">
      <RouterLink
        v-for="(article, i) in run"
        :key="`${article.id}-${i}`"
        :to="`/article/${article.id}`"
        :aria-hidden="i >= run.length / 2"
        :tabindex="i >= run.length / 2 ? -1 : 0"
      >
        {{ article.title }}
      </RouterLink>
    </div>
  </div>
</template>
