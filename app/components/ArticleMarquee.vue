<script setup lang="ts">
import { ARTICLES } from '~/data/content'

/** Bandeau défilant des titres — la signature visuelle du site. */
const run = [...ARTICLES, ...ARTICLES]
</script>

<template>
  <div class="marquee" aria-label="Tous les articles">
    <div class="marquee-run">
      <NuxtLink
        v-for="(article, i) in run"
        :key="`${article.id}-${i}`"
        :to="`/article/${article.id}`"
        :aria-hidden="i >= run.length / 2"
        :tabindex="i >= run.length / 2 ? -1 : 0"
      >
        {{ article.title }}
      </NuxtLink>
    </div>
  </div>
</template>
