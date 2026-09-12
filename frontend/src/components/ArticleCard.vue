<script setup>
import CoverImage from './CoverImage.vue'
import { frDate } from '@/lib/format'
import { SITE } from '@/data/site'

defineProps({ article: { type: Object, required: true } })
</script>

<template>
  <RouterLink class="card" :to="`/article/${article.id}`">
    <CoverImage
      :src="article.cover"
      :seed="article.chars % 97"
      ratio="4 / 5"
      :alt="article.title"
    />
    <h3>{{ article.title }}</h3>
    <p class="dek">{{ article.dek }}</p>
    <div class="meta">
      <span class="byline">{{ SITE.byline }}</span>
      <time :datetime="article.date">le {{ frDate(article.date) }}</time>
      <span>{{ article.minutes }} min</span>
    </div>
  </RouterLink>
</template>
