<script setup lang="ts">
import { frDate } from '#shared/utils/format'

import type listArticles from '~~/server/api/articles/index.get'

/**
 * The type is INFERRED from the handler, not copied: renaming a column in
 * the Drizzle schema makes `pnpm typecheck` fail right here. That is
 * precisely what the move to TypeScript buys, and what FastAPI plus plain
 * JavaScript Vue could not give.
 *
 * `import type` is erased at compile time: no server code enters the bundle
 * sent to the browser.
 */
type ArticleList = Awaited<ReturnType<typeof listArticles>>['items'][number]

defineProps<{ article: ArticleList; byline?: string }>()
</script>

<template>
  <NuxtLink class="card" :to="`/article/${article.slug}`">
    <CoverImage
      :src="article.coverUrl"
      :seed="article.charCount % 97"
      ratio="4 / 5"
      :alt="article.coverAlt ?? article.title"
    />
    <h3>{{ article.title }}</h3>
    <p class="dek">{{ article.dek }}</p>
    <div class="meta">
      <span v-if="byline" class="byline">{{ byline }}</span>
      <time v-if="article.publishedAt" :datetime="article.publishedAt">
        le {{ frDate(article.publishedAt) }}
      </time>
      <span>{{ article.readingMinutes }} min</span>
    </div>
  </NuxtLink>
</template>
