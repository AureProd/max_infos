<script setup lang="ts">
/** Bandeau défilant des titres — la signature visuelle du site. */
const { data } = await useFetch('/api/articles', { key: 'marquee', query: { size: 50 } })
const run = computed(() => {
  const items = data.value?.items ?? []
  return [...items, ...items]
})
</script>

<template>
  <div class="marquee" aria-label="Tous les articles">
    <div class="marquee-run">
      <NuxtLink
        v-for="(article, i) in run"
        :key="`${article.slug}-${i}`"
        :to="`/article/${article.slug}`"
        :aria-hidden="i >= run.length / 2"
        :tabindex="i >= run.length / 2 ? -1 : 0"
      >
        {{ article.title }}
      </NuxtLink>
    </div>
  </div>
</template>
