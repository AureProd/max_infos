<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { findArticle } from '~/data/content'
import { findMedia } from '~/data/instagram'
import { SITE } from '~/data/site'

const route = useRoute()
const item = computed(() => findMedia(String(route.params.id)))
const article = computed(() => (item.value ? findArticle(item.value.articleId) : null))

if (!item.value) {
  throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
}

/** Seul l'aperçu de carrousel porte une légende ; les embeds n'en ont pas. */
const legende = computed(() => {
  const m = item.value
  return m && 'caption' in m ? m.caption : SITE.tagline
})

useSeoMeta({
  title: () => (article.value ? `Déclinaison — ${article.value.title}` : 'Publication'),
  description: () => legende.value,
})
</script>

<template>
  <div class="wrap">
    <article v-if="item" class="notepage">
      <NuxtLink class="back" to="/">← Retour</NuxtLink>

      <p v-if="'preview' in item && item.preview" class="todo" style="margin-bottom: 20px">
        aperçu du format carrousel — aucun carrousel publié pour l'instant
      </p>

      <InstagramEmbed
        v-if="'shortcode' in item && item.shortcode"
        :shortcode="item.shortcode"
        :kind="item.kind"
        style="max-width: 400px"
      />
      <SlideCarousel
        v-else-if="'slides' in item"
        :slides="item.slides"
        :handle="SITE.instagram.handle"
      />

      <p v-if="'caption' in item && item.caption" class="cap">{{ item.caption }}</p>

      <div class="meta">
        <time :datetime="item.date">{{ frDate(item.date) }}</time>
        <a
          :href="('url' in item && item.url) || SITE.instagram.url"
          target="_blank"
          rel="noopener"
        >
          {{ SITE.instagram.handle }}
        </a>
      </div>

      <p v-if="article" class="endnote">
        Tiré de
        <NuxtLink :to="`/article/${article.id}`">« {{ article.title }} »</NuxtLink>
      </p>
    </article>
  </div>
</template>
