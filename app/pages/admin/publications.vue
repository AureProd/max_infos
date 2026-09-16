<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel, networkLabel } from '#shared/utils/social'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: publications, refresh } = await useFetch('/api/admin/social-posts', {
  key: 'admin-publications',
})
const { data: articles } = await useFetch('/api/admin/articles', { key: 'admin-articles-liste' })
const { data: linked } = await useFetch('/api/social-posts', { key: 'publications-liees' })

/** Posts discovered and not yet attached: the work left to do. */
const toAttach = computed(
  () => (publications.value ?? []).filter((p) => !p.hidden && !p.articleSlug).length,
)

/**
 * The per-account filter.
 *
 * Purely local: the list is already loaded, and sorting it server-side
 * would cost a request per click.
 */
const filterCount = ref('')

const accounts = computed(() => {
  const vus = new Map<number, string>()
  for (const p of publications.value ?? []) {
    if (p.accountId && p.accountUsername) vus.set(p.accountId, p.accountUsername)
  }
  return [...vus].map(([id, username]) => ({ id, username }))
})

const visible = computed(() =>
  filterCount.value === ''
    ? (publications.value ?? [])
    : (publications.value ?? []).filter((p) => String(p.accountId ?? '') === filterCount.value),
)

async function attach(id: number, slug: string): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/article`, {
    method: 'PUT',
    body: { articleSlug: slug || null },
  })
  await refresh()
}

async function toggleVisibility(id: number, hidden: boolean): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/visibility`, { method: 'PUT', body: { hidden } })
  await refresh()
}

async function remove(id: number): Promise<void> {
  if (!confirm('Supprimer cette publication ? Cette action est définitive.')) return
  await $fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' })
  await refresh()
}

// --- Manual entry ----------------------------------------------------------
const input = ref({ network: 'linkedin' as 'linkedin' | 'instagram', url: '', caption: '' })
const inputError = ref('')

async function add(): Promise<void> {
  inputError.value = ''
  try {
    await $fetch('/api/admin/social-posts', { method: 'POST', body: input.value })
    input.value = { network: 'linkedin', url: '', caption: '' }
    await refresh()
  } catch (e) {
    inputError.value = (e as { statusMessage?: string }).statusMessage ?? 'Adresse non reconnue.'
  }
}

useSeoMeta({ title: 'Publications', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>Publications</h1>
        <p class="admin-lede">
          {{ linked?.length ?? 0 }} visible(s) sur le site<template v-if="toAttach">
            · {{ toAttach }} découverte(s) sans article rattaché</template
          >
        </p>
      </div>
    </div>

      <!--
        La saisie manuelle est la SEULE voie pour LinkedIn : lire ses propres
        publications y est impossible, le scope r_member_social étant fermé
        aux nouvelles applications.
      -->
    <div class="admin-card" style="margin-bottom: 20px">
      <form @submit.prevent="add">
        <label class="a-label" for="p-url">Coller l'adresse d'une publication</label>
        <div class="a-toolbar">
          <select v-model="input.network" class="a-select" aria-label="Réseau">
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            id="p-url"
            v-model="input.url"
            class="a-input"
            type="url"
            placeholder="https://www.linkedin.com/posts/…"
            required
          />
          <button class="a-btn a-btn-primary" type="submit">Ajouter</button>
        </div>
        <p v-if="inputError" class="a-err">{{ inputError }}</p>
      </form>
    </div>

    <div class="admin-card">
      <div v-if="accounts.length > 1" class="a-toolbar">
        <select id="p-compte" v-model="filterCount" class="a-select" aria-label="Compte">
          <option value="">— tous les comptes —</option>
          <option v-for="c in accounts" :key="c.id" :value="String(c.id)">@{{ c.username }}</option>
        </select>
      </div>

      <p v-if="!publications?.length" class="a-empty">Aucune publication pour l'instant.</p>

      <table v-else class="a-table">
        <thead>
          <tr>
            <th>Publication</th>
            <th class="a-col-state">Réseau</th>
            <th class="a-col-date">Publiée le</th>
            <th>Article rattaché</th>
            <th class="a-col-act"><span class="a-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visible" :key="p.id">
            <td>
              <a v-if="p.permalink" class="a-title" :href="p.permalink" target="_blank" rel="noopener">
                {{ p.caption?.slice(0, 60) || mediaLabel(p.mediaType) }} ↗
              </a>
              <span v-else class="a-title">
                {{ p.caption?.slice(0, 60) || mediaLabel(p.mediaType) }}
              </span>
              <div class="a-sub">
                <span v-if="p.accountUsername">@{{ p.accountUsername }}</span>
                <span>{{ mediaLabel(p.mediaType) }}</span>
                <span>{{ p.source === 'api' ? 'découverte' : 'saisie' }}</span>
                <span v-if="p.hidden" class="a-tag is-draft">masquée</span>
              </div>
            </td>
            <td>
              <span class="a-tag is-info">{{ networkLabel(p.network) }}</span>
            </td>
            <td class="a-date">
              <time v-if="p.postedAt" :datetime="p.postedAt">
                {{ frDate(p.postedAt.slice(0, 10)) }}
              </time>
              <span v-else class="a-nil">—</span>
            </td>
            <td>
              <select
                class="a-select a-select-wide"
                :value="p.articleSlug ?? ''"
                aria-label="Article rattaché"
                @change="attach(p.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— non rattachée —</option>
                <option v-for="a in articles ?? []" :key="a.slug" :value="a.slug">
                  {{ a.title }}
                </option>
              </select>
            </td>
            <td>
              <div class="a-row-act">
                <button class="a-btn" type="button" @click="toggleVisibility(p.id, !p.hidden)">
                  {{ p.hidden ? 'Afficher' : 'Masquer' }}
                </button>
                <button class="a-btn a-btn-danger" type="button" @click="remove(p.id)">
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
