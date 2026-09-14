<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

const { data: publications, refresh } = await useFetch('/api/admin/social-posts', {
  key: 'admin-publications',
})
const { data: articles } = await useFetch('/api/admin/articles', { key: 'admin-articles-liste' })
const { data: liees } = await useFetch('/api/social-posts', { key: 'publications-liees' })

/** Les publications découvertes et non encore rattachées : le travail à faire. */
const aRattacher = computed(
  () => (publications.value ?? []).filter((p) => !p.hidden && !rattachements.value[p.id]).length,
)

/** Quel article porte chaque publication, pour l'afficher sans requête de plus. */
const rattachements = ref<Record<number, string>>({})

async function chargerRattachements(): Promise<void> {
  const table: Record<number, string> = {}
  for (const a of articles.value ?? []) {
    const detail = await $fetch<{ declinaisons: { id: number }[] }>(
      `/api/articles/${a.slug}`,
    ).catch(() => null)
    for (const d of detail?.declinaisons ?? []) table[d.id] = a.slug
  }
  rattachements.value = table
}
await chargerRattachements()

async function rattacher(id: number, slug: string): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/article`, {
    method: 'PUT',
    body: { articleSlug: slug || null },
  })
  await chargerRattachements()
}

async function basculerVisibilite(id: number, hidden: boolean): Promise<void> {
  await $fetch(`/api/admin/social-posts/${id}/visibility`, { method: 'PUT', body: { hidden } })
  await refresh()
}

async function supprimer(id: number): Promise<void> {
  if (!confirm('Supprimer cette publication ? Cette action est définitive.')) return
  await $fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' })
  await refresh()
}

// --- Saisie manuelle -------------------------------------------------------
const saisie = ref({ network: 'linkedin' as 'linkedin' | 'instagram', url: '', caption: '' })
const erreurSaisie = ref('')

async function ajouter(): Promise<void> {
  erreurSaisie.value = ''
  try {
    await $fetch('/api/admin/social-posts', { method: 'POST', body: saisie.value })
    saisie.value = { network: 'linkedin', url: '', caption: '' }
    await refresh()
  } catch (e) {
    erreurSaisie.value = (e as { statusMessage?: string }).statusMessage ?? 'Adresse non reconnue.'
  }
}

useSeoMeta({ title: 'Publications', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav />

      <h1>Publications</h1>
      <p v-if="aRattacher" class="note">
        {{ aRattacher }} publication(s) découverte(s) et non rattachée(s) à un article.
      </p>

      <!--
        La saisie manuelle est la SEULE voie pour LinkedIn : lire ses propres
        publications y est impossible, le scope r_member_social étant fermé
        aux nouvelles applications.
      -->
      <form class="field" style="margin: 24px 0" @submit.prevent="ajouter">
        <label for="p-url">Coller l'adresse d'une publication</label>
        <div class="cluster">
          <select v-model="saisie.network" aria-label="Réseau">
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            id="p-url"
            v-model="saisie.url"
            type="url"
            placeholder="https://www.linkedin.com/posts/…"
            required
          />
          <button class="btn btn-primary" type="submit">Ajouter</button>
        </div>
        <p v-if="erreurSaisie" class="err">{{ erreurSaisie }}</p>
      </form>

      <p v-if="!publications?.length" class="empty">Aucune publication pour l'instant.</p>

      <ul v-else class="list">
        <li v-for="p in publications" :key="p.id">
          <div class="entry">
            <div>
              <h3>
                <a v-if="p.permalink" :href="p.permalink" target="_blank" rel="noopener">
                  {{ p.caption?.slice(0, 70) || `${p.network} ${p.shortcode ?? ''}` }} ↗
                </a>
                <span v-else>{{ p.caption?.slice(0, 70) || p.network }}</span>
              </h3>
              <div class="meta">
                <span class="pill">{{ p.network }}</span>
                <span v-if="p.mediaType">{{ p.mediaType }}</span>
                <span class="pill">{{ p.source === 'api' ? 'découverte' : 'saisie' }}</span>
                <time v-if="p.postedAt" :datetime="p.postedAt">
                  {{ frDate(p.postedAt.slice(0, 10)) }}
                </time>
                <span v-if="p.hidden" class="todo">masquée</span>
              </div>
            </div>

            <div class="cluster">
              <select
                :value="rattachements[p.id] ?? ''"
                aria-label="Article rattaché"
                @change="rattacher(p.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— non rattachée —</option>
                <option v-for="a in articles ?? []" :key="a.slug" :value="a.slug">
                  {{ a.title }}
                </option>
              </select>
              <button class="btn" type="button" @click="basculerVisibilite(p.id, !p.hidden)">
                {{ p.hidden ? 'Afficher' : 'Masquer' }}
              </button>
              <button class="btn" type="button" @click="supprimer(p.id)">Supprimer</button>
            </div>
          </div>
        </li>
      </ul>

      <p class="hint" style="margin-top: 24px">
        {{ liees?.length ?? 0 }} publication(s) visible(s) sur le site.
      </p>
    </section>
  </div>
</template>
