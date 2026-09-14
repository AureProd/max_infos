<script setup lang="ts">
const { data: site } = await useSite()
const { data: posts } = await useFetch('/api/social-posts', {
  key: 'ig-block',
  query: { network: 'instagram' },
})
const { data: liste } = await useFetch('/api/articles', { key: 'ig-block-articles' })
</script>

<template>
  <section class="section">
    <div class="igp-head">
      <div class="igp-avatar">
        <div class="in" />
      </div>
      <div class="igp-id">
        <a
          class="igp-handle"
          :href="site?.instagram_public.url"
          target="_blank"
          rel="noopener"
        >
          {{ site?.instagram_public.handle }}
          <span class="igp-follow">Suivre</span>
        </a>
        <div class="igp-stats">
          <span
            ><b>{{ posts?.length ?? 0 }}</b> publications</span
          >
          <span
            ><b>{{ liste?.total ?? 0 }}</b> articles</span
          >
        </div>
        <p class="igp-bio">{{ site?.identity.tagline }}</p>
      </div>
    </div>

    <div class="section-head">
      <h2>Sur Instagram</h2>
      <span class="rule" />
      <a class="note" :href="site?.instagram_public.url" target="_blank" rel="noopener">
        Voir le compte ↗
      </a>
    </div>

    <ul class="ig-live">
      <li v-for="item in posts ?? []" :key="item.id">
        <InstagramEmbed
          v-if="item.shortcode"
          :shortcode="item.shortcode"
          :kind="item.mediaType === 'reel' ? 'reel' : 'p'"
        />
        <NuxtLink class="ig-src" :to="`/publication/${item.id}`">Ouvrir la publication</NuxtLink>
      </li>
    </ul>
  </section>
</template>
