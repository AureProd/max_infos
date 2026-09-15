<script setup lang="ts">
import { frDate } from '#shared/utils/format'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const { data: site } = await useSite()
const { data: posts } = await useFetch('/api/social-posts', { key: 'publications' })

const item = computed(() => posts.value?.find((p) => p.id === id.value))

// Same reason as on the article page: without this, a non-existent post
// would answer 200.
if (!item.value) {
  throw createError({ statusCode: 404, statusMessage: 'Publication introuvable', fatal: true })
}
const { data: article } = await useFetch('/api/articles', {
  key: () => `publication-article-${id.value}`,
  query: { size: 50 },
})
const attached = computed(() =>
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
          v-if="item.permalink ?? item.url ?? item.accountUsername"
          :href="
            item.permalink ??
            item.url ??
            `https://www.instagram.com/${item.accountUsername}`
          "
          target="_blank"
          rel="noopener"
        >
          {{ item.accountUsername ? `@${item.accountUsername}` : 'Voir la publication ↗' }}
        </a>
      </div>

      <p v-if="attached" class="endnote">
        Tiré de
        <NuxtLink :to="`/article/${attached.slug}`">« {{ attached.title }} »</NuxtLink>
      </p>
    </article>

    <p v-else class="empty">
      Cette publication n'existe pas. <NuxtLink to="/">Retour à l'accueil</NuxtLink>
    </p>
  </div>
</template>
