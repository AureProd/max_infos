<script setup lang="ts">
import { frDate } from '#shared/utils/format'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const { data: site } = await useSite()
const { data: posts } = await useFetch('/api/social-posts', { key: 'publications' })

const item = computed(() => posts.value?.find((p) => p.id === id.value))
const { data: article } = await useFetch('/api/articles', {
  key: () => `publication-article-${id.value}`,
  query: { taille: 50 },
})
const rattache = computed(() =>
  article.value?.items.find((a) => a.slug && item.value && a.slug === item.value.shortcode),
)

useSeoMeta({
  title: () => item.value?.caption ?? 'Publication',
  description: () => item.value?.caption ?? site.value?.identity.tagline,
  robots: 'noindex',
})
</script>

<template>
  <div class="wrap">
    <article v-if="item" class="notepage">
      <NuxtLink class="back" to="/">← Retour</NuxtLink>

      <div style="max-width: 400px">
        <PublicationCard :publication="item" />
      </div>

      <p v-if="item.caption" class="cap">{{ item.caption }}</p>

      <div class="meta">
        <time v-if="item.postedAt" :datetime="item.postedAt">
          {{ frDate(item.postedAt.slice(0, 10)) }}
        </time>
        <a
          :href="item.permalink ?? item.url ?? site?.instagram_public.url"
          target="_blank"
          rel="noopener"
        >
          {{ site?.instagram_public.handle }}
        </a>
      </div>

      <p v-if="rattache" class="endnote">
        Tiré de
        <NuxtLink :to="`/article/${rattache.slug}`">« {{ rattache.title }} »</NuxtLink>
      </p>
    </article>

    <p v-else class="empty">
      Cette publication n'existe pas. <NuxtLink to="/">Retour à l'accueil</NuxtLink>
    </p>
  </div>
</template>
