<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel } from '#shared/utils/social'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: bord } = await useFetch('/api/admin/dashboard', { key: 'admin-bord' })

/*
 * Les graphiques arrivent à part.
 *
 * `/api/admin/stats` agrège toute la table des lectures ; la liste des
 * choses à faire, elle, doit s'afficher tout de suite. Deux requêtes plutôt
 * qu'une : l'écran ne reste pas blanc le temps d'un `group by`.
 */
const { data: stats } = await useFetch('/api/admin/stats', { key: 'admin-stats' })
const { colors, base } = useChartTheme()

const frJour = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Lectures par jour. Une courbe : c'est une évolution, pas un classement. */
const courbeLectures = computed(() => ({
  labels: (stats.value?.parJour ?? []).map((d) => frJour(d.day)),
  datasets: [
    {
      data: (stats.value?.parJour ?? []).map((d) => d.views),
      borderColor: colors.value.accent,
      backgroundColor: colors.value.accentSoft,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: colors.value.accent,
      pointHoverBorderColor: colors.value.surface,
      pointHoverBorderWidth: 2,
    },
  ],
}))

/** Barres HORIZONTALES : des titres d'articles ne tiennent pas sous un axe. */
const barres = (rows: { label: string; views: number }[]) => ({
  labels: rows.map((r) => r.label),
  datasets: [
    {
      data: rows.map((r) => r.views),
      backgroundColor: colors.value.accent,
      borderRadius: 4,
      borderSkipped: false,
      barThickness: 14,
    },
  ],
})

/** Coupé par la FIN, seul endroit où une coupure se comprend. */
const court = (text: string, max = 26): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

const parArticle = computed(() =>
  barres((stats.value?.parArticle ?? []).map((a) => ({ label: court(a.title), views: a.views }))),
)

const parTag = computed(() =>
  barres((stats.value?.parTag ?? []).map((t) => ({ label: court(t.label), views: t.views }))),
)

/** Une courbe n'a pas de grille verticale : elle n'apporte rien à la lecture. */
const optionsCourbe = computed(() => ({
  ...base.value,
  scales: {
    ...base.value.scales,
    x: { ...base.value.scales.x, grid: { display: false } },
    y: {
      ...base.value.scales.y,
      beginAtZero: true,
      ticks: { ...base.value.scales.y.ticks, precision: 0 },
    },
  },
}))

const optionsBarres = computed(() => ({
  ...base.value,
  indexAxis: 'y' as const,
  interaction: { mode: 'nearest' as const, intersect: true },
  scales: {
    x: {
      ...base.value.scales.x,
      beginAtZero: true,
      ticks: { ...base.value.scales.x.ticks, precision: 0 },
    },
    y: { ...base.value.scales.y, grid: { display: false } },
  },
}))

/** Y a-t-il seulement quelque chose à tracer ? */
const lu = computed(() => (stats.value?.parJour ?? []).some((d) => d.views > 0))

const { user } = useUser()

const firstName = computed(() => user.value?.name?.split(' ')[0] ?? '')

/**
 * Three figures of the SAME kind: totals.
 *
 * The third used to be the length of a list capped at five, shown beside
 * two real aggregates. Three numbers presented identically must be
 * comparable, otherwise the screen teaches nothing.
 */
const figures = computed(() => [
  { value: bord.value?.vuesSemaine ?? 0, label: 'lectures sur sept jours', to: null },
  { value: bord.value?.nbBrouillons ?? 0, label: 'brouillons en cours', to: '/admin/articles' },
  {
    value: bord.value?.nbNonRattachees ?? 0,
    label: 'publications à rattacher',
    to: '/admin/publications',
  },
])

useSeoMeta({ title: 'Tableau de bord', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>{{ firstName ? `Bonjour ${firstName}` : 'Tableau de bord' }}</h1>
        <p class="admin-lede">Ce qu'il y a à faire, et ce qui a été lu cette semaine.</p>
      </div>
    </div>

    <!--
      Les alertes sont des choses à FAIRE, et chacune mène à l'écran où on
      la règle. Elles ne répètent pas les chiffres ci-dessous : elles disent
      ce qui cloche, pas ce qui va.
    -->
    <ul v-if="bord?.alerts.length" class="a-alerts">
      <li v-for="(a, i) in bord.alerts" :key="i" :class="a.niveau">
        <NuxtLink :to="a.link">{{ a.message }} →</NuxtLink>
      </li>
    </ul>

    <div class="a-figures">
      <component
        :is="f.to ? 'NuxtLink' : 'div'"
        v-for="f in figures"
        :key="f.label"
        :to="f.to ?? undefined"
        class="a-figure"
      >
        <strong>{{ f.value }}</strong>
        <span>{{ f.label }}</span>
      </component>
    </div>

    <!--
      Ce qui est LU. Les trois graphiques portent une seule série chacun,
      donc une seule couleur et aucune légende : le titre dit déjà ce qui
      est tracé, et donner une teinte par barre inventerait une identité que
      l'axe porte déjà.
    -->
    <section class="admin-card a-chart-wide">
      <div class="a-chart-head">
        <h2>Lectures, sur {{ stats?.fenetre ?? 30 }} jours</h2>
      </div>
      <p v-if="!lu" class="a-empty">
        Pas encore de lecture enregistrée. C'est normal les premiers jours.
      </p>
      <!-- Hauteur portée par le conteneur : un <canvas> sans hauteur fixe
           grandit à l'infini à chaque redimensionnement. -->
      <div v-else class="a-chart" style="height: 220px">
        <Chart type="line" :data="courbeLectures" :options="optionsCourbe" class="h-full" />
      </div>
    </section>

    <div class="a-cols">
      <section class="admin-card">
        <div class="a-chart-head">
          <h2>Les articles les plus lus</h2>
          <span class="a-chart-note">{{ stats?.fenetre ?? 30 }} derniers jours</span>
        </div>
        <p v-if="!stats?.parArticle.length" class="a-empty">Rien à classer pour l'instant.</p>
        <div v-else class="a-chart" :style="{ height: `${Math.max(140, stats.parArticle.length * 32)}px` }">
          <Chart type="bar" :data="parArticle" :options="optionsBarres" class="h-full" />
        </div>
      </section>

      <section class="admin-card">
        <div class="a-chart-head">
          <h2>Les tags qui fonctionnent</h2>
          <span class="a-chart-note">lectures cumulées</span>
        </div>
        <p v-if="!stats?.parTag.length" class="a-empty">Rien à classer pour l'instant.</p>
        <template v-else>
          <div class="a-chart" :style="{ height: `${Math.max(140, stats.parTag.length * 32)}px` }">
            <Chart type="bar" :data="parTag" :options="optionsBarres" class="h-full" />
          </div>
          <!--
            Un article porte plusieurs tags, donc ses lectures comptent pour
            chacun : la somme des barres dépasse le total du site. On compare
            des sujets entre eux, on ne partage pas un gâteau — et il vaut
            mieux l'écrire que laisser quelqu'un additionner.
          -->
          <p class="hint">
            Un article compte pour chacun de ses tags : ces barres se comparent entre elles,
            elles ne s'additionnent pas.
          </p>
        </template>
      </section>
    </div>

    <div class="a-cols">
      <section class="admin-card">
        <h2>Reprendre un brouillon</h2>
        <p v-if="!bord?.brouillons.length" class="a-empty">Aucun brouillon en attente.</p>
        <ul v-else class="a-lines">
          <li v-for="b in bord.brouillons" :key="b.slug">
            <NuxtLink class="a-title" :to="`/admin/${b.slug}`">{{ b.title }}</NuxtLink>
            <span class="a-date">modifié le {{ frDate(b.updatedAt.slice(0, 10)) }}</span>
          </li>
        </ul>
      </section>

      <section class="admin-card">
        <h2>Le plus lu cette semaine</h2>
        <p v-if="!bord?.populaires.length" class="a-empty">
          Pas encore de lecture enregistrée. C'est normal les premiers jours.
        </p>
        <ul v-else class="a-lines">
          <li v-for="p in bord.populaires" :key="p.slug">
            <NuxtLink class="a-title" :to="`/article/${p.slug}`" target="_blank">
              {{ p.title }}
            </NuxtLink>
            <span class="a-tag is-info">{{ p.views }} lectures</span>
          </li>
        </ul>
      </section>
    </div>

    <!--
      Le détail des publications à rattacher. L'alerte dit COMBIEN et mène
      ici ; ce bloc montre lesquelles. La même information n'est plus
      présentée trois fois sous trois formes.
    -->
    <section v-if="bord?.nonRattachees.length" class="admin-card" style="margin-top: 20px">
      <h2>Publications sans article</h2>
      <p class="admin-lede">
        Rattacher une publication à un article permet de la montrer à côté du texte
        qu'elle annonce.
      </p>
      <ul class="a-lines">
        <li v-for="p in bord.nonRattachees" :key="p.id">
          <a v-if="p.permalink" class="a-title" :href="p.permalink" target="_blank" rel="noopener">
            {{ p.caption?.slice(0, 70) || mediaLabel(null) }} ↗
          </a>
          <span v-else class="a-title">{{ p.caption?.slice(0, 70) || mediaLabel(null) }}</span>
          <span class="a-date">
            <time v-if="p.postedAt" :datetime="p.postedAt">
              {{ frDate(p.postedAt.slice(0, 10)) }}
            </time>
          </span>
        </li>
      </ul>
      <NuxtLink class="a-btn" to="/admin/publications" style="margin-top: 14px">
        Rattacher ces publications
      </NuxtLink>
    </section>
  </div>
</template>
