<script setup>
import SlideCarousel from './SlideCarousel.vue'
import InstagramEmbed from './InstagramEmbed.vue'
import InstagramConnect from './InstagramConnect.vue'
import { IG_MEDIA, IG_CAROUSEL_PREVIEW } from '@/data/instagram'
import { findArticle, ARTICLES } from '@/data/content'
import { SITE } from '@/data/site'
</script>

<template>
  <section class="section">
    <div class="igp-head">
      <div class="igp-avatar">
        <div class="in" />
      </div>
      <div class="igp-id">
        <a class="igp-handle" :href="SITE.instagram.url" target="_blank" rel="noopener">
          {{ SITE.instagram.handle }}
          <span class="igp-follow">Suivre</span>
        </a>
        <div class="igp-stats">
          <span
            ><b>{{ IG_MEDIA.length }}</b> publications</span
          >
          <span
            ><b>{{ ARTICLES.length }}</b> articles</span
          >
        </div>
        <p class="igp-bio">{{ SITE.tagline }}</p>
      </div>
    </div>

    <div class="section-head">
      <h2>Sur Instagram</h2>
      <span class="rule" />
      <a class="note" :href="SITE.instagram.url" target="_blank" rel="noopener"
        >Voir le compte ↗</a
      >
    </div>

    <ul class="ig-live">
      <li v-for="item in IG_MEDIA" :key="item.id">
        <InstagramEmbed :shortcode="item.shortcode" :kind="item.kind" />
        <RouterLink
          v-if="findArticle(item.articleId)"
          class="ig-src"
          :to="`/article/${item.articleId}`"
        >
          L'article : « {{ findArticle(item.articleId).title }} »
        </RouterLink>
      </li>
    </ul>

    <div class="section-head" style="margin-top: 54px">
      <h2>Le format carrousel</h2>
      <span class="rule" />
      <span class="todo">à venir</span>
    </div>
    <p class="ig-note">
      Tu n'as pas encore publié de carrousel. Voici le rendu qui les attend : dès que tu en publies
      un, son identifiant se colle dans <code>src/data/instagram.js</code> et l'embed officiel
      remplace cet aperçu.
    </p>

    <div class="ig-preview">
      <SlideCarousel :slides="IG_CAROUSEL_PREVIEW.slides" :handle="SITE.instagram.handle" />
      <div class="ig-preview-text">
        <p>{{ IG_CAROUSEL_PREVIEW.caption }}</p>
        <RouterLink class="ig-src" :to="`/publication/${IG_CAROUSEL_PREVIEW.id}`">
          Ouvrir l'aperçu en grand
        </RouterLink>
      </div>
    </div>

    <InstagramConnect />
  </section>
</template>
