<script setup lang="ts">
import { frDate } from '#shared/utils/format'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: articles, refresh } = await useFetch('/api/admin/articles', { key: 'admin-liste' })
const { ok, fail } = useNotify()
const confirm = useConfirm()

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
  try {
    const created = await $fetch<{ slug: string }>('/api/admin/articles', {
      method: 'POST',
      body: { title: 'Nouvel article', bodyHtml: '', tags: [] },
    })
    await navigateTo(`/admin/${created.slug}`)
  } catch (e) {
    fail(e, 'Création impossible')
  }
}

/**
 * Publishing from the list.
 *
 * The route already existed and nothing called it: Max had to open an
 * article to change its state, then come back.
 */
async function toggle(slug: string, current: string): Promise<void> {
  const next = current === 'published' ? 'draft' : 'published'
  try {
    await $fetch(`/api/admin/articles/${slug}/status`, { method: 'PUT', body: { status: next } })
    await refresh()
    ok(next === 'published' ? 'Article publié' : 'Article dépublié')
  } catch (e) {
    fail(e, 'Changement d’état refusé')
  }
}

function remove(slug: string, title: string): void {
  confirm.require({
    header: 'Supprimer cet article',
    message: `« ${title} » sera supprimé définitivement.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: async () => {
      try {
        await $fetch(`/api/admin/articles/${slug}`, { method: 'DELETE' })
        await refresh()
        ok('Article supprimé')
      } catch (e) {
        fail(e, 'Suppression refusée')
      }
    },
  })
}

/**
 * Toute la ligne ouvre l'édition, pas seulement le titre.
 *
 * Il fallait viser un lien de quelques mots dans une rangée haute de 56 px,
 * et rater la cible ne faisait rien du tout. Les actions de la ligne, elles,
 * ne doivent PAS déclencher l'ouverture : d'où le garde-fou sur la cible du
 * clic, qui laisse passer un bouton, un lien ou un champ.
 */
function openRow(event: MouseEvent, slug: string): void {
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, select, label')) return
  void navigateTo(`/admin/${slug}`)
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
      <!--
        Deux boutons, et l'un compte plus que l'autre : rapatrier est une
        opération rare, écrire est le geste du quotidien. « Sujets » a quitté
        cette barre — c'est un onglet à part entière maintenant.
      -->
      <div class="admin-actions">
        <SubstackPanel @imported="refresh" />
        <Button icon="pi pi-plus" label="Nouvel article" @click="create" />
      </div>
    </div>

    <div class="admin-card">
      <div class="a-toolbar">
        <IconField class="a-grow">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" type="search" placeholder="Rechercher un titre…" fluid />
        </IconField>
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
          <tr
            v-for="a in rows"
            :key="a.slug"
            class="a-row-open"
            tabindex="0"
            @click="openRow($event, a.slug)"
            @keydown.enter="navigateTo(`/admin/${a.slug}`)"
          >
            <td data-label="Titre">
              <NuxtLink class="a-title" :to="`/admin/${a.slug}`">{{ a.title }}</NuxtLink>
            </td>
            <td data-label="État">
              <!-- Deux couleurs, pas deux mots de la même couleur : l'état
                   doit se lire sans être lu. -->
              <span :class="['a-tag', a.status === 'published' ? 'is-ok' : 'is-draft']">
                {{ a.status === 'published' ? 'publié' : 'brouillon' }}
              </span>
            </td>
            <td class="a-date" data-label="Publié le">
              <time v-if="a.publishedAt" :datetime="a.publishedAt">
                {{ frDate(a.publishedAt.slice(0, 10)) }}
              </time>
              <span v-else class="a-nil">—</span>
            </td>
            <td class="a-date" data-label="Modifié le">{{ frDate(a.updatedAt.slice(0, 10)) }}</td>
            <td data-label="Actions">
              <div class="a-row-act">
                <!--
                  La couleur suit ce que l'action FAIT, et son remplissage
                  dit laquelle est la bonne : publier est le geste qu'on
                  vient faire, donc plein et bleu ; retirer du site est un
                  avertissement, donc contour orange.
                -->
                <Button
                  v-if="a.status === 'published'"
                  v-tooltip.top="'Dépublier'"
                  severity="warn"
                  outlined
                  size="small"
                  icon="pi pi-inbox"
                  aria-label="Dépublier"
                  @click="toggle(a.slug, a.status)"
                />
                <Button
                  v-else
                  v-tooltip.top="'Publier'"
                  size="small"
                  icon="pi pi-send"
                  aria-label="Publier"
                  @click="toggle(a.slug, a.status)"
                />
                <a
                  v-if="a.status === 'published'"
                  v-tooltip.top="'Voir sur le site'"
                  class="a-icon-link"
                  :href="`/article/${a.slug}`"
                  target="_blank"
                  rel="noopener"
                  aria-label="Voir sur le site"
                >
                  <i class="pi pi-external-link" aria-hidden="true" />
                </a>
                <Button
                  v-tooltip.top="'Supprimer'"
                  severity="danger"
                  outlined
                  size="small"
                  icon="pi pi-trash"
                  aria-label="Supprimer"
                  @click="remove(a.slug, a.title)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
