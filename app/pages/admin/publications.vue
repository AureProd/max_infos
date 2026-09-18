<script setup lang="ts">
import { frDate } from '#shared/utils/format'
import { mediaLabel, networkLabel } from '#shared/utils/social'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { data: publications, refresh } = await useFetch('/api/admin/social-posts', {
  key: 'admin-publications',
})
const { data: articles } = await useFetch('/api/admin/articles', { key: 'admin-articles-liste' })
const { data: linked } = await useFetch('/api/social-posts', { key: 'publications-liees' })
const { ok, fail } = useNotify()
const confirm = useConfirm()

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
  try {
    await $fetch(`/api/admin/social-posts/${id}/article`, {
      method: 'PUT',
      body: { articleSlug: slug || null },
    })
    await refresh()
    ok(slug ? 'Publication rattachée' : 'Publication détachée')
  } catch (e) {
    fail(e, 'Rattachement refusé')
  }
}

async function toggleVisibility(id: number, hidden: boolean): Promise<void> {
  try {
    await $fetch(`/api/admin/social-posts/${id}/visibility`, { method: 'PUT', body: { hidden } })
    await refresh()
    ok(hidden ? 'Publication masquée' : 'Publication affichée')
  } catch (e) {
    fail(e, 'Changement refusé')
  }
}

/**
 * Corriger le titre d'une publication.
 *
 * Il venait des balises de la page et rien ne permettait de le reprendre :
 * un titre tronqué ou absent restait tel quel sur le site.
 */
const editing = ref<number | null>(null)
const captionDraft = ref('')

function startCaption(id: number, caption: string | null): void {
  editing.value = id
  captionDraft.value = caption ?? ''
}

async function saveCaption(): Promise<void> {
  const id = editing.value
  if (id === null) return
  try {
    await $fetch<unknown>(`/api/admin/social-posts/${id}/caption`, {
      method: 'PUT',
      body: { caption: captionDraft.value.trim() || null },
    })
    editing.value = null
    await refresh()
    ok('Titre modifié')
  } catch (e) {
    fail(e, 'Modification refusée')
  }
}

function remove(id: number): void {
  confirm.require({
    header: 'Supprimer cette publication',
    message: 'Elle disparaîtra du site. La publication elle-même n’est pas touchée.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: async () => {
      try {
        await $fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' })
        await refresh()
        ok('Publication supprimée')
      } catch (e) {
        fail(e, 'Suppression refusée')
      }
    },
  })
}

/**
 * The publication whose article is being chosen.
 *
 * A window rather than a <select>: the select carried whole article titles,
 * so it stretched its column until the page itself scrolled sideways, and
 * it could neither be searched nor show the state of each article.
 */
const chooserFor = ref<number | null>(null)

const titleOf = (slug: string): string =>
  (articles.value ?? []).find((a) => a.slug === slug)?.title ?? slug

async function chooseArticle(id: number, slug: string): Promise<void> {
  chooserFor.value = null
  await attach(id, slug)
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
      aux nouvelles applications. Le même formulaire sert dans l'écran d'un
      article, déjà pointé sur lui.
    -->
    <div class="admin-card" style="margin-bottom: 20px">
      <h2>Importer une publication</h2>
      <PostImportForm @added="refresh" />
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
            <td data-label="Publication">
              <!--
                La vignette, le compte et la légende : l'écran n'affichait
                qu'un identifiant brut (« instagram DdGUF5XJbhE »), qui ne
                permet pas de reconnaître la publication qu'on rattache.
              -->
              <div class="a-pub">
                <div class="a-pub-thumb">
                  <img v-if="p.thumbnailUrl" :src="p.thumbnailUrl" alt="" loading="lazy" />
                  <span v-else class="a-pub-nothumb">{{ mediaLabel(p.mediaType) }}</span>
                </div>
                <div class="a-pub-text">
                  <a
                    v-if="p.permalink"
                    class="a-title"
                    :href="p.permalink"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ p.caption?.slice(0, 90) || mediaLabel(p.mediaType) }} ↗
                  </a>
                  <span v-else class="a-title">
                    {{ p.caption?.slice(0, 90) || mediaLabel(p.mediaType) }}
                  </span>
                  <div class="a-sub">
                    <span v-if="p.accountUsername">@{{ p.accountUsername }}</span>
                    <span>{{ mediaLabel(p.mediaType) }}</span>
                    <span>{{ p.source === 'api' ? 'découverte' : 'saisie' }}</span>
                    <span v-if="p.mediaUrl" class="a-tag is-info">vidéo</span>
                    <span v-if="p.hidden" class="a-tag is-draft">masquée</span>
                  </div>
                </div>
              </div>
            </td>
            <td data-label="Réseau">
              <span class="a-tag is-info">{{ networkLabel(p.network) }}</span>
            </td>
            <td class="a-date" data-label="Publiée le">
              <time v-if="p.postedAt" :datetime="p.postedAt">
                {{ frDate(p.postedAt.slice(0, 10)) }}
              </time>
              <span v-else class="a-nil">—</span>
            </td>
            <td data-label="Article rattaché">
              <button class="a-link-btn" type="button" @click="chooserFor = p.id">
                <template v-if="p.articleSlug">
                  {{ titleOf(p.articleSlug) }}
                </template>
                <span v-else class="a-nil">— rattacher —</span>
              </button>
            </td>
            <td data-label="Actions">
              <div class="a-row-act">
                <Button
                  v-tooltip.top="'Modifier le titre'"
                  severity="secondary"
                  outlined
                  size="small"
                  icon="pi pi-pencil"
                  aria-label="Modifier le titre"
                  @click="startCaption(p.id, p.caption)"
                />
                <Button
                  v-tooltip.top="p.hidden ? 'Afficher sur le site' : 'Masquer du site'"
                  severity="secondary"
                  outlined
                  size="small"
                  :icon="p.hidden ? 'pi pi-eye' : 'pi pi-eye-slash'"
                  :aria-label="p.hidden ? 'Afficher' : 'Masquer'"
                  @click="toggleVisibility(p.id, !p.hidden)"
                />
                <Button
                  v-tooltip.top="'Supprimer'"
                  severity="danger"
                  outlined
                  size="small"
                  icon="pi pi-trash"
                  aria-label="Supprimer"
                  @click="remove(p.id)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!--
      Le titre se corrige dans une FENÊTRE, et non dans la ligne : le champ
      s'y battait avec la vignette et la légende, et la rangée changeait de
      hauteur sous le curseur.
    -->
    <Dialog
      :visible="editing !== null"
      modal
      header="Titre de la publication"
      :style="{ width: '32rem', maxWidth: 'calc(100vw - 2rem)' }"
      :pt="{ root: { class: 'admin-ui' } }"
      @update:visible="editing = null"
    >
      <p class="hint">
        C'est ce que le site affiche sous la vignette. Vidé, la carte reprend le type de média.
      </p>
      <Textarea v-model="captionDraft" rows="3" fluid autofocus />

      <template #footer>
        <Button severity="secondary" outlined label="Annuler" @click="editing = null" />
        <Button icon="pi pi-check" label="Enregistrer" @click="saveCaption" />
      </template>
    </Dialog>

    <ArticleChooser
      v-if="chooserFor !== null"
      :articles="articles ?? []"
      :current="(publications ?? []).find((p) => p.id === chooserFor)?.articleSlug ?? null"
      :publication="(publications ?? []).find((p) => p.id === chooserFor) ?? null"
      @close="chooserFor = null"
      @choose="(slug) => chooseArticle(chooserFor as number, slug)"
    />
  </div>
</template>
