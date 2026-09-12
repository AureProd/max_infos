<script setup>
import { computed } from 'vue'
import CoverImage from '@/components/CoverImage.vue'
import ArticleCard from '@/components/ArticleCard.vue'
import ArticleMarquee from '@/components/ArticleMarquee.vue'
import FilterBar from '@/components/FilterBar.vue'
import InstagramBlock from '@/components/InstagramBlock.vue'
import { ARTICLES } from '@/data/content'
import { useFilters } from '@/composables/useFilters'
import { SITE } from '@/data/site'
import { frDate, frShort } from '@/lib/format'

const { articles, isActive } = useFilters()
const feature = computed(() => ARTICLES[0])
const rail = computed(() => ARTICLES.slice(1, 4))
const rest = computed(() => ARTICLES.slice(1))
</script>

<template>
  <div class="wrap">
    <section class="hero">
      <h1>{{ SITE.tagline }}</h1>
      <p class="strap">{{ SITE.pitch }}</p>
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

    <section class="front">
      <RouterLink class="feature" :to="`/article/${feature.id}`">
        <CoverImage :src="feature.cover" :seed="7" ratio="4 / 5" :alt="feature.title" />
        <div class="feature-text">
          <div class="kicker">À la une</div>
          <h2>{{ feature.title }}</h2>
          <p class="dek">{{ feature.dek }}</p>
          <div class="meta">
            <span class="byline">{{ SITE.byline }}</span>
            <time :datetime="feature.date">le {{ frDate(feature.date) }}</time>
            <span>{{ feature.minutes }} min de lecture</span>
            <span>{{ feature.tags.join(', ') }}</span>
          </div>
        </div>
      </RouterLink>

      <div class="rail">
        <h3>Derniers articles</h3>
        <ol>
          <li v-for="article in rail" :key="article.id">
            <RouterLink :to="`/article/${article.id}`">
              <CoverImage
                :src="article.cover"
                :seed="article.chars % 97"
                ratio="1 / 1"
                :alt="article.title"
              />
              <div>
                <p class="cap">{{ article.title }}</p>
                <div class="meta">
                  <time :datetime="article.date">{{ frShort(article.date) }}</time>
                  <span>{{ article.minutes }} min</span>
                </div>
              </div>
            </RouterLink>
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
        <span class="note">{{ ARTICLES.length }} publiés</span>
      </div>
      <ul class="cards">
        <li v-for="article in rest" :key="article.id">
          <ArticleCard :article="article" />
        </li>
      </ul>
    </section>

    <InstagramBlock />

    <section class="section">
      <div class="section-head">
        <h2>Tout parcourir</h2>
        <span class="rule" />
        <span v-if="isActive" class="note">{{ articles.length }} résultat(s)</span>
      </div>

      <FilterBar />

      <p v-if="articles.length === 0" class="empty">Aucun article ne correspond.</p>
      <ul v-else class="list">
        <li v-for="article in articles" :key="article.id">
          <RouterLink class="entry" :to="`/article/${article.id}`">
            <div>
              <h3>{{ article.title }}</h3>
              <p class="dek">{{ article.dek }}</p>
              <div class="meta">
                <time :datetime="article.date">{{ frDate(article.date) }}</time>
                <span>{{ article.minutes }} min</span>
                <span>{{ article.tags.join(', ') }}</span>
              </div>
            </div>
            <CoverImage
              :src="article.cover"
              :seed="article.chars % 97"
              ratio="1 / 1"
              :alt="article.title"
            />
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
