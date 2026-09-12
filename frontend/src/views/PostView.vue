<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SlideCarousel from '@/components/SlideCarousel.vue'
import InstagramEmbed from '@/components/InstagramEmbed.vue'
import { findMedia } from '@/data/instagram'
import { findArticle } from '@/data/content'
import { frDate } from '@/lib/format'
import { SITE } from '@/data/site'

const route = useRoute()
const item = computed(() => findMedia(route.params.id))
const article = computed(() => (item.value ? findArticle(item.value.articleId) : null))
</script>

<template>
  <div class="wrap">
    <article v-if="item" class="notepage">
      <RouterLink class="back" to="/">← Retour</RouterLink>

      <p v-if="item.preview" class="todo" style="margin-bottom: 20px">
        aperçu du format carrousel — aucun carrousel publié pour l'instant
      </p>

      <InstagramEmbed
        v-if="item.shortcode"
        :shortcode="item.shortcode"
        :kind="item.kind"
        style="max-width: 400px"
      />
      <SlideCarousel v-else :slides="item.slides" :handle="SITE.instagram.handle" />

      <p v-if="item.caption" class="cap">{{ item.caption }}</p>

      <div class="meta">
        <time :datetime="item.date">{{ frDate(item.date) }}</time>
        <a :href="item.url || SITE.instagram.url" target="_blank" rel="noopener">
          {{ SITE.instagram.handle }}
        </a>
      </div>

      <p v-if="article" class="endnote">
        Tiré de
        <RouterLink :to="`/article/${article.id}`">« {{ article.title }} »</RouterLink>
      </p>
    </article>

    <p v-else class="empty">
      Cette publication n'existe pas. <RouterLink to="/">Retour à l'accueil</RouterLink>
    </p>
  </div>
</template>
