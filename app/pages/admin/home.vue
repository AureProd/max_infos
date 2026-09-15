<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { valeur: accueil, etat, charger, enregistrer } = useReglage('home')
await charger()

const { data: articles } = await useFetch('/api/admin/articles', { key: 'accueil-articles' })
const publies = computed(() => (articles.value ?? []).filter((a) => a.status === 'published'))

/** Les sections de la page d'accueil, dans l'ordre où elles s'affichent. */
const LIBELLES: Record<string, string> = {
  hero: 'Accroche',
  front: 'À la une',
  marquee: 'Bandeau défilant',
  articles: 'Les articles',
  instagram: 'Sur Instagram',
  all: 'Tout parcourir',
}

const TOUTES = Object.keys(LIBELLES)

const actives = computed({
  get: () => accueil.value?.sections ?? [],
  set: (v: string[]) => {
    if (accueil.value) accueil.value.sections = v
  },
})

function basculer(section: string): void {
  actives.value = actives.value.includes(section)
    ? actives.value.filter((s) => s !== section)
    : [...actives.value, section]
}

function deplacer(section: string, sens: -1 | 1): void {
  const liste = [...actives.value]
  const i = liste.indexOf(section)
  const j = i + sens
  if (i < 0 || j < 0 || j >= liste.length) return
  ;[liste[i], liste[j]] = [liste[j] as string, liste[i] as string]
  actives.value = liste
}

function basculerUne(slug: string): void {
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
        <span v-if="etat === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="etat === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="enregistrer">Enregistrer</button>
      </AdminNav>

      <h1>Page d'accueil</h1>

      <h2>Sections affichées, dans l'ordre</h2>
      <ul class="list">
        <li v-for="(section, i) in actives" :key="section">
          <div class="entry">
            <div>
              <h3>{{ LIBELLES[section] ?? section }}</h3>
              <div class="meta"><span>position {{ i + 1 }}</span></div>
            </div>
            <div class="cluster">
              <button class="btn" type="button" :disabled="i === 0" @click="deplacer(section, -1)">
                ↑
              </button>
              <button
                class="btn"
                type="button"
                :disabled="i === actives.length - 1"
                @click="deplacer(section, 1)"
              >
                ↓
              </button>
              <button class="btn" type="button" @click="basculer(section)">Retirer</button>
            </div>
          </div>
        </li>
      </ul>

      <h2>Sections masquées</h2>
      <div class="chips">
        <button
          v-for="s in TOUTES.filter((s) => !actives.includes(s))"
          :key="s"
          class="chip"
          type="button"
          @click="basculer(s)"
        >
          + {{ LIBELLES[s] ?? s }}
        </button>
      </div>
      <p v-if="TOUTES.every((s) => actives.includes(s))" class="hint">
        Toutes les sections sont affichées.
      </p>

      <h2>Articles à la une</h2>
      <p class="hint">
        Ceux qui remontent en tête. Sans sélection, ce sont les plus récents qui s'affichent.
      </p>
      <div class="chips">
        <button
          v-for="a in publies"
          :key="a.slug"
          class="chip"
          type="button"
          :aria-pressed="accueil?.featured.includes(a.slug)"
          @click="basculerUne(a.slug)"
        >
          {{ accueil?.featured.includes(a.slug) ? '★' : '☆' }} {{ a.title }}
        </button>
      </div>
    </section>
  </div>
</template>
