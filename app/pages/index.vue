<script setup lang="ts">
import { frDate, frShort } from '#shared/utils/format'

const { data: site } = await useSite()
const { data: list } = await useFetch('/api/articles', { key: 'accueil', query: { taille: 20 } })
const { articles, tags, state, isActive, total, toggleTag } = useFilters()

const all = computed(() => list.value?.items ?? [])
const feature = computed(() => all.value[0])
const rail = computed(() => all.value.slice(1, 4))
const rest = computed(() => all.value.slice(1))

useSeoMeta({
  title: () => site.value?.identity.name,
  description: () => site.value?.identity.tagline,
  ogTitle: () => site.value?.identity.name,
  ogDescription: () => site.value?.identity.pitch,
  ogType: 'website',
})
</script>

<template>
  <div class="wrap">
    <section class="hero">
      <h1>{{ site?.identity.tagline }}</h1>
      <p class="strap">{{ site?.identity.pitch }}</p>
      <p class="scroll-cue">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="5 9 12 16 19 9" />
        </svg>
        Défiler
      </p>
    </section>

    <section v-if="feature" class="front">
      <NuxtLink class="feature" :to="`/article/${feature.slug}`">
        <CoverImage :src="feature.coverUrl" :seed="7" ratio="4 / 5" :alt="feature.title" />
        <div class="feature-text">
          <div class="kicker">À la une</div>
          <h2>{{ feature.title }}</h2>
          <p class="dek">{{ feature.dek }}</p>
          <div class="meta">
            <span class="byline">{{ site?.identity.byline }}</span>
            <time v-if="feature.publishedAt" :datetime="feature.publishedAt">
              le {{ frDate(feature.publishedAt) }}
            </time>
            <span>{{ feature.readingMinutes }} min de lecture</span>
            <span>{{ feature.tags.map((t) => t.label).join(', ') }}</span>
          </div>
        </div>
      </NuxtLink>

      <div class="rail">
        <h3>Derniers articles</h3>
        <ol>
          <li v-for="article in rail" :key="article.slug">
            <NuxtLink :to="`/article/${article.slug}`">
              <CoverImage
                :src="article.coverUrl"
                :seed="article.charCount % 97"
                ratio="1 / 1"
                :alt="article.title"
              />
              <div>
                <p class="cap">{{ article.title }}</p>
                <div class="meta">
                  <time v-if="article.publishedAt" :datetime="article.publishedAt">
                    {{ frShort(article.publishedAt) }}
                  </time>
                  <span>{{ article.readingMinutes }} min</span>
                </div>
              </div>
            </NuxtLink>
          </li>
        </ol>
      </div>
    </section>
  </div>

  <ArticleMarquee />

  <div class="wrap">
    <section class="section" style="border-top: none">
      <div class="section-head">
        <h2>Les articles</h2>
        <span class="rule" />
        <span class="note">{{ list?.total ?? 0 }} publiés</span>
      </div>
      <ul class="cards">
        <li v-for="article in rest" :key="article.slug">
          <ArticleCard :article="article" :byline="site?.identity.byline" />
        </li>
      </ul>
    </section>

    <InstagramBlock />

    <section class="section">
      <div class="section-head">
        <h2>Tout parcourir</h2>
        <span class="rule" />
        <span v-if="isActive" class="note">{{ total }} résultat(s)</span>
      </div>

      <section class="filters">
        <label class="search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            id="q"
            v-model="state.q"
            type="search"
            placeholder="Chercher dans les articles et les notes"
            aria-label="Chercher"
          />
        </label>
        <div class="tags" role="group" aria-label="Filtrer par sujet">
          <button
            v-for="tag in tags"
            :key="tag.slug"
            class="tag"
            :aria-pressed="state.tag === tag.slug"
            @click="toggleTag(tag.slug)"
          >
            {{ tag.label }}
          </button>
        </div>
      </section>

      <p v-if="articles.length === 0" class="empty">Aucun article ne correspond.</p>
      <ul v-else class="list">
        <li v-for="article in articles" :key="article.slug">
          <NuxtLink class="entry" :to="`/article/${article.slug}`">
            <div>
              <h3>{{ article.title }}</h3>
              <p class="dek">{{ article.dek }}</p>
              <div class="meta">
                <time v-if="article.publishedAt" :datetime="article.publishedAt">
                  {{ frDate(article.publishedAt) }}
                </time>
                <span>{{ article.readingMinutes }} min</span>
                <span>{{ article.tags.map((t) => t.label).join(', ') }}</span>
              </div>
            </div>
            <CoverImage
              :src="article.coverUrl"
              :seed="article.charCount % 97"
              ratio="1 / 1"
              :alt="article.title"
            />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
