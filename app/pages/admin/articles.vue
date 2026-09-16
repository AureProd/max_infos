<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: articles, refresh } = await useFetch('/api/admin/articles', { key: 'admin-liste' })

/**
 * Search and status filter, in the browser.
 *
 * The list is Max's own articles — a few dozen, not a few thousand. Asking
 * the server would add a round trip for nothing; the day it grows, the
 * route already knows how to paginate.
 */
const search = ref('')
const status = ref<'all' | 'published' | 'draft'>('all')

const rows = computed(() =>
  (articles.value ?? []).filter((a) => {
    if (status.value !== 'all' && a.status !== status.value) return false
    const q = search.value.trim().toLowerCase()
    return !q || a.title.toLowerCase().includes(q)
  }),
)

const counts = computed(() => {
  const all = articles.value ?? []
  return {
    all: all.length,
    published: all.filter((a) => a.status === 'published').length,
    draft: all.filter((a) => a.status === 'draft').length,
  }
})

async function create(): Promise<void> {
  const created = await $fetch<{ slug: string }>('/api/admin/articles', {
    method: 'POST',
    body: { title: 'Nouvel article', bodyMd: '', tags: [] },
  })
  await navigateTo(`/admin/${created.slug}`)
}

/**
 * Publishing from the list.
 *
 * The route already existed and nothing called it: Max had to open an
 * article to change its state, then come back.
 */
async function toggle(slug: string, current: string): Promise<void> {
  const next = current === 'published' ? 'draft' : 'published'
  await $fetch(`/api/admin/articles/${slug}/status`, { method: 'PUT', body: { status: next } })
  await refresh()
}

async function remove(slug: string, title: string): Promise<void> {
  if (!confirm(`Supprimer « ${title} » ? Cette action est définitive.`)) return
  await $fetch(`/api/admin/articles/${slug}`, { method: 'DELETE' })
  await refresh()
}

useSeoMeta({ title: 'Articles', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>Articles</h1>
        <p class="admin-lede">
          {{ counts.all }} au total · {{ counts.published }} publiés ·
          {{ counts.draft }} brouillons
        </p>
      </div>
      <div class="admin-actions">
        <SubstackPanel @imported="refresh" />
        <button class="a-btn a-btn-primary" type="button" @click="create">Nouvel article</button>
      </div>
    </div>

    <div class="admin-card">
      <div class="a-toolbar">
        <input v-model="search" class="a-input" type="search" placeholder="Rechercher un titre…" />
        <div class="a-seg" role="group" aria-label="Filtrer par état">
          <button
            v-for="s in (['all', 'published', 'draft'] as const)"
            :key="s"
            type="button"
            :aria-pressed="status === s"
            @click="status = s"
          >
            {{ s === 'all' ? 'Tous' : s === 'published' ? 'Publiés' : 'Brouillons' }}
          </button>
        </div>
      </div>

      <p v-if="!articles?.length" class="a-empty">
        Aucun article pour l'instant. Commence par en créer un.
      </p>
      <p v-else-if="!rows.length" class="a-empty">Aucun article ne correspond à ce filtre.</p>

      <table v-else class="a-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th class="a-col-state">État</th>
            <th class="a-col-date">Publié le</th>
            <th class="a-col-date">Modifié le</th>
            <th class="a-col-act"><span class="a-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in rows" :key="a.slug">
            <td>
              <NuxtLink class="a-title" :to="`/admin/${a.slug}`">{{ a.title }}</NuxtLink>
            </td>
            <td>
              <!-- Deux couleurs, pas deux mots de la même couleur : l'état
                   doit se lire sans être lu. -->
              <span :class="['a-tag', a.status === 'published' ? 'is-ok' : 'is-draft']">
                {{ a.status === 'published' ? 'publié' : 'brouillon' }}
              </span>
            </td>
            <td class="a-date">
              <time v-if="a.publishedAt" :datetime="a.publishedAt">
                {{ frDate(a.publishedAt.slice(0, 10)) }}
              </time>
              <span v-else class="a-nil">—</span>
            </td>
            <td class="a-date">{{ frDate(a.updatedAt.slice(0, 10)) }}</td>
            <td>
              <div class="a-row-act">
                <button class="a-btn" type="button" @click="toggle(a.slug, a.status)">
                  {{ a.status === 'published' ? 'Dépublier' : 'Publier' }}
                </button>
                <NuxtLink
                  v-if="a.status === 'published'"
                  class="a-btn"
                  :to="`/article/${a.slug}`"
                  target="_blank"
                >
                  Voir ↗
                </NuxtLink>
                <button class="a-btn a-btn-danger" type="button" @click="remove(a.slug, a.title)">
                  Supprimer
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
