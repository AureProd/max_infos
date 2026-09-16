<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel } from '#shared/utils/social'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: bord } = await useFetch('/api/admin/dashboard', { key: 'admin-bord' })

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
      <div class="admin-actions">
        <NuxtLink class="a-btn a-btn-primary" to="/admin/articles">Écrire</NuxtLink>
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
