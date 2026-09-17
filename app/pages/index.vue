<script setup lang="ts">
import { frDate, frShort } from '#shared/utils/format'

const { data: site } = await useSite()
const { data: list } = await useFetch('/api/articles', { key: 'accueil', query: { size: 20 } })
const { articles, tags, state, isActive, total, toggleTag, page, pages, goTo } = useFilters()

const all = computed(() => list.value?.items ?? [])

/**
 * Les tags les plus portés d'abord.
 *
 * `/api/tags` renvoie déjà `n`, le nombre d'articles publiés qui portent le
 * tag, mais il trie par ordre alphabétique — l'ordre qu'il faut au
 * back-office pour retrouver un sujet, pas celui qu'il faut ici. Le rail ne
 * montre qu'une ligne : ce qui compte est que les sujets réellement
 * travaillés soient en tête, pas que « Algérie » précède « sport ».
 *
 * Trié ici plutôt que dans l'API pour ne pas déranger l'écran des tags.
 */
const ranked = computed(() =>
  [...tags.value].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'fr')),
)
const feature = computed(() => all.value[0])
const rail = computed(() => all.value.slice(1, 4))

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
        <i class="pi pi-angle-down" aria-hidden="true" />
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
            <span class="byline">{{ site?.identity.author }}</span>
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

  <div class="wrap">
    <InstagramBlock />

    <section class="section">
      <div class="section-head">
        <h2>Les articles</h2>
        <span class="rule" />
        <span class="note">
          {{ isActive ? `${total} résultat(s)` : `${list?.total ?? 0} publiés` }}
        </span>
      </div>

      <section class="filters">
        <label class="search">
          <i class="pi pi-search" aria-hidden="true" />
          <input
            id="q"
            v-model="state.q"
            type="search"
            placeholder="Chercher un article"
            aria-label="Chercher"
          />
        </label>
        <div class="tags" role="group" aria-label="Filtrer par tag">
          <button
            v-for="tag in ranked"
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
      <ul v-else class="cards">
        <li v-for="article in articles" :key="article.slug">
          <ArticleCard :article="article" :byline="site?.identity.author" />
        </li>
      </ul>

      <!--
        Le compteur annonçait « 38 résultat(s) » et la liste en montrait
        douze, sans aucun moyen d'atteindre les vingt-six autres : ils
        étaient simplement inaccessibles.
      -->
      <nav v-if="pages > 1" class="pager" aria-label="Pages d'articles">
        <button type="button" :disabled="page <= 1" @click="goTo(page - 1)">← Précédents</button>
        <span>page {{ page }} sur {{ pages }}</span>
        <button type="button" :disabled="page >= pages" @click="goTo(page + 1)">Suivants →</button>
      </nav>
    </section>
  </div>

  <!--
    Le bandeau ferme la page au lieu de la couper en deux. Il était posé
    entre la une et les réseaux, là où le lecteur venait justement de
    choisir quoi lire : une seconde liste de titres à cet endroit ne fait
    que reprendre la décision qu'il vient de prendre.
  -->
  <ArticleMarquee />
</template>
