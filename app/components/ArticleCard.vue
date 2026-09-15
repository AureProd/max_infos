<script setup lang="ts">
import { frDate } from '#shared/utils/format'

import type listArticles from '~~/server/api/articles/index.get'

/**
 * Le type est INFÉRÉ du handler, il n'est pas recopié : renommer une
 * colonne dans le schéma Drizzle fait échouer `pnpm typecheck` here même.
 * C'est précisément ce qu'on achète avec la bascule en TypeScript, et ce
 * que FastAPI + Vue en JavaScript nu ne pouvaient pas donner.
 *
 * `import type` est effacé à la compilation : aucun code serveur n'entre
 * dans le paquet envoyé au navigateur.
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
