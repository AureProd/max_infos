<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { value: accueil, state, load, save } = useSetting('home')
await load()

const { data: articles } = await useFetch('/api/admin/articles', { key: 'accueil-articles' })
const published = computed(() => (articles.value ?? []).filter((a) => a.status === 'published'))

/** The home page sections, in the order they appear. */
const LABELS: Record<string, string> = {
  hero: 'Accroche',
  front: 'À la une',
  marquee: 'Bandeau défilant',
  articles: 'Les articles',
  instagram: 'Sur Instagram',
  all: 'Tout parcourir',
}

const ALL = Object.keys(LABELS)

const actives = computed({
  get: () => accueil.value?.sections ?? [],
  set: (v: string[]) => {
    if (accueil.value) accueil.value.sections = v
  },
})

function toggle(section: string): void {
  actives.value = actives.value.includes(section)
    ? actives.value.filter((s) => s !== section)
    : [...actives.value, section]
}

function move(section: string, sens: -1 | 1): void {
  const list = [...actives.value]
  const i = list.indexOf(section)
  const j = i + sens
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j] as string, list[i] as string]
  actives.value = list
}

function toggleOne(slug: string): void {
  if (!accueil.value) return
  accueil.value.featured = accueil.value.featured.includes(slug)
    ? accueil.value.featured.filter((s) => s !== slug)
    : [...accueil.value.featured, slug]
}

useSeoMeta({ title: 'Accueil', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="state === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="state === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="save">Enregistrer</button>
      </AdminNav>

      <h1>Page d'accueil</h1>

      <h2>Sections affichées, dans l'ordre</h2>
      <ul class="list">
        <li v-for="(section, i) in actives" :key="section">
          <div class="entry">
            <div>
              <h3>{{ LABELS[section] ?? section }}</h3>
              <div class="meta"><span>position {{ i + 1 }}</span></div>
            </div>
            <div class="cluster">
              <button class="btn" type="button" :disabled="i === 0" @click="move(section, -1)">
                ↑
              </button>
              <button
                class="btn"
                type="button"
                :disabled="i === actives.length - 1"
                @click="move(section, 1)"
              >
                ↓
              </button>
              <button class="btn" type="button" @click="toggle(section)">Retirer</button>
            </div>
          </div>
        </li>
      </ul>

      <h2>Sections masquées</h2>
      <div class="chips">
        <button
          v-for="s in ALL.filter((s) => !actives.includes(s))"
          :key="s"
          class="chip"
          type="button"
          @click="toggle(s)"
        >
          + {{ LABELS[s] ?? s }}
        </button>
      </div>
      <p v-if="ALL.every((s) => actives.includes(s))" class="hint">
        Toutes les sections sont affichées.
      </p>

      <h2>Articles à la une</h2>
      <p class="hint">
        Ceux qui remontent en tête. Sans sélection, ce sont les plus récents qui s'affichent.
      </p>
      <div class="chips">
        <button
          v-for="a in published"
          :key="a.slug"
          class="chip"
          type="button"
          :aria-pressed="accueil?.featured.includes(a.slug)"
          @click="toggleOne(a.slug)"
        >
          {{ accueil?.featured.includes(a.slug) ? '★' : '☆' }} {{ a.title }}
        </button>
      </div>
    </section>
  </div>
</template>
