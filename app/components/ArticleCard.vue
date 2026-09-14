<script setup lang="ts">
import type { Article } from '#shared/types/content'
import { frDate } from '#shared/utils/format'
import { SITE } from '~/data/site'

defineProps<{ article: Article }>()
</script>

<template>
  <NuxtLink class="card" :to="`/article/${article.id}`">
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
  </NuxtLink>
</template>
