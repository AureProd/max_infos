<script setup lang="ts">
import { addTagLabel, normalizeTagLabel, toggleTag } from '#shared/utils/tags'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const route = useRoute()
const slug = ref<string | null>(String(route.params.slug))

const { draft, preview, status, record, modified, load, save, changeStatus } = useDraft(slug)

await load()

/**
 * The tags already in use.
 *
 * `/api/admin/tags` existed and NOTHING called it: the only way to tag an
 * article was to retype it from memory, and each variant of spelling
 * created one more tag. Reusing an existing one is now a click.
 */
const { data: known } = await useFetch('/api/admin/tags', { key: 'tags-connus' })
const { ok, fail } = useNotify()
const confirmDialog = useConfirm()

/**
 * Les publications rattachées à cet article.
 *
 * Le panneau « Décliner » a disparu — il proposait de recopier un gabarit
 * dans LinkedIn, ce que Max ne fait pas. Ce qu'il portait d'utile, le
 * rattachement d'une publication, est repris ici par le formulaire de
 * l'écran Publications, déjà pointé sur l'article courant.
 */
const { data: attached, refresh: refreshAttached } = await useFetch('/api/social-posts', {
  key: () => `article-publications-${slug.value}`,
  query: { article: slug },
})

const knownLabels = computed(() => (known.value ?? []).map((t) => t.label))

/**
 * The subjects are CHOSEN, no longer typed.
 *
 * The free-text field split on commas had three faults, all met in use: a
 * comma inside a label cut it in two, « Histoire » retyped became a second
 * tag, and the same list lived in the input, in the draft and in a watcher
 * rewriting the input. The dialog leaves one source of truth: `draft.tags`.
 */
const picking = ref(false)
const search = ref('')

/** Everything known, plus what is selected without being known yet. */
const choices = computed(() => {
  const all = [...new Set([...knownLabels.value, ...draft.value.tags])]
  const needle = normalizeTagLabel(search.value).toLowerCase()
  return all
    .filter((label) => label.toLowerCase().includes(needle))
    .sort((a, b) => a.localeCompare(b, 'fr'))
})

/** True while what is typed matches nothing: the only case that creates. */
const isNew = computed(() => {
  const wanted = normalizeTagLabel(search.value)
  return wanted !== '' && !choices.value.some((c) => c.toLowerCase() === wanted.toLowerCase())
})

function createTag(): void {
  draft.value.tags = addTagLabel(draft.value.tags, knownLabels.value, search.value)
  search.value = ''
}

function flipTag(label: string): void {
  draft.value.tags = toggleTag(draft.value.tags, label)
}

/**
 * Housekeeping: a subject no article carries can be deleted.
 *
 * Every misspelling created one more tag and nothing removed it, so the
 * list only ever grew. The count comes from the server, and so does the
 * refusal: a subject still in use answers 409 rather than being stripped
 * off the articles carrying it.
 */
const orphan = computed(() => {
  const byLabel = new Map((known.value ?? []).map((t) => [t.label, t]))
  return (label: string) => {
    const t = byLabel.get(label)
    return t !== undefined && t.n === 0 && !draft.value.tags.includes(label) ? t.slug : null
  }
})

function dropTag(tagSlug: string, label: string): void {
  confirmDialog.require({
    header: 'Supprimer ce tag',
    message: `« ${label} » sera supprimé définitivement. Aucun article ne le porte.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: async () => {
      try {
        await $fetch<unknown>(`/api/admin/tags/${tagSlug}`, { method: 'DELETE' })
        known.value = (known.value ?? []).filter((t) => t.slug !== tagSlug)
        ok('Tag supprimé')
      } catch (e) {
        fail(e, 'Suppression refusée')
      }
    },
  })
}

function removeTag(label: string): void {
  draft.value.tags = toggleTag(draft.value.tags, label)
}

// Automatic saving: Max writes, he does not have to think about saving.
let timer: ReturnType<typeof setTimeout> | undefined
watch(modified, (change) => {
  if (!change) return
  clearTimeout(timer)
  timer = setTimeout(save, 1500)
})

// Leaving the page with unsent edits would lose text.
onBeforeRouteLeave(async () => {
  if (modified.value) await save()
})

/**
 * The preview is a WINDOW, not a column.
 *
 * Side by side it showed the body alone, with the site's dark stylesheet
 * inside the light back-office: neither pretty nor faithful, and it left
 * out the cover, the title and the dek — the very things one wants to
 * check.
 */
const previewOpen = ref(false)

/**
 * The cover's address, for the preview.
 *
 * The picker holds an identifier; the preview needs the URL, exactly as the
 * public page receives it.
 */
const { data: medias } = await useFetch('/api/admin/media', { key: 'medias-apercu' })
const coverUrl = computed(
  () => (medias.value?.items ?? []).find((m) => m.id === draft.value.coverMediaId)?.url ?? null,
)

const { data: site } = await useSite()

useSeoMeta({ title: () => `${draft.value.title} — Rédaction`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <div class="admin-title">
      <div>
        <h1>{{ draft.title || 'Sans titre' }}</h1>
        <p class="admin-lede">
          <NuxtLink to="/admin/articles">← Tous les articles</NuxtLink>
          ·
          <span :class="['a-tag', status === 'published' ? 'is-ok' : 'is-draft']">
            {{ status === 'published' ? 'publié' : 'brouillon' }}
          </span>
          ·
          <!--
            L'enregistrement est automatique : il n'y a plus de bouton, donc
            il faut un état. Trois mots et une icône, toujours au même
            endroit — un indicateur qui apparaît et disparaît se remarque
            moins qu'un indicateur qui change.
          -->
          <SaveState
            :modified="modified"
            :saving="record === 'en cours'"
            :failed="record === 'échec'"
            :saved="record === 'enregistré'"
          />
        </p>
      </div>
      <div class="admin-actions">
        <Button
          severity="secondary"
          outlined
          icon="pi pi-eye"
          label="Aperçu"
          @click="previewOpen = true"
        />
        <Button
          v-if="status === 'draft'"
          icon="pi pi-send"
          label="Publier"
          @click="changeStatus('published')"
        />
        <Button
          v-else
          severity="secondary"
          outlined
          icon="pi pi-eye-slash"
          label="Dépublier"
          @click="changeStatus('draft')"
        />
      </div>
    </div>

    <div class="a-editor">
      <div class="admin-card">
          <div class="field">
            <label for="a-title">Titre</label>
            <input id="a-title" v-model="draft.title" type="text" />
          </div>
          <div class="field">
            <label for="a-dek">Sous-titre</label>
            <input id="a-dek" v-model="draft.dek" type="text" />
          </div>
          <div class="field">
            <div class="a-label-row">
              <span class="a-label">Tags</span>
              <Button
                v-tooltip.top="'Ajouter un tag'"
                severity="secondary"
                outlined
                size="small"
                icon="pi pi-plus"
                aria-label="Ajouter un tag"
                @click="picking = true"
              />
            </div>
            <div class="a-chosen">
              <button
                v-for="t in draft.tags"
                :key="t"
                class="a-chip is-on"
                type="button"
                :title="`Retirer « ${t} »`"
                @click="removeTag(t)"
              >
                {{ t }} <i class="pi pi-times" aria-hidden="true" />
              </button>
              <span v-if="!draft.tags.length" class="a-nil">Aucun tag pour l'instant.</span>
            </div>
          </div>

          <Dialog
            v-model:visible="picking"
            modal
            header="Tags de l'article"
            :style="{ width: '32rem', maxWidth: 'calc(100vw - 2rem)' }"
          >
            <p class="hint">
              Coche ceux qui existent déjà. Un tag ne se crée que s'il ne ressemble à aucun
              autre — c'est ce qui empêche « Histoire » et « histoire » de cohabiter.
            </p>

            <InputText
              v-model="search"
              class="a-tagsearch"
              placeholder="Chercher ou créer un tag"
              autofocus
              @keydown.enter.prevent="isNew && createTag()"
            />

            <Button
              v-if="isNew"
              class="a-tagnew"
              size="small"
              :label="`Créer « ${normalizeTagLabel(search)} »`"
              @click="createTag"
            />

            <ul class="a-taglist">
              <li v-for="label in choices" :key="label">
                <Checkbox
                  :input-id="`tag-${label}`"
                  :model-value="draft.tags.includes(label)"
                  binary
                  @update:model-value="flipTag(label)"
                />
                <label :for="`tag-${label}`">{{ label }}</label>
                <!--
                  Le bouton ne paraît que sur un tag qu'aucun article ne
                  porte : ailleurs, supprimer voudrait dire le retirer des
                  articles, ce que personne ne demande depuis cet écran.
                -->
                <Button
                  v-if="orphan(label)"
                  v-tooltip.top="`Aucun article ne porte « ${label} »`"
                  class="a-tagdrop"
                  severity="danger"
                  text
                  size="small"
                  icon="pi pi-trash"
                  aria-label="Supprimer ce tag"
                  @click="dropTag(orphan(label) as string, label)"
                />
              </li>
              <li v-if="!choices.length && !isNew" class="a-nil">Aucun tag pour l'instant.</li>
            </ul>

            <template #footer>
              <Button label="Fermer" @click="picking = false" />
            </template>
          </Dialog>
        <MediaField v-model="draft.coverMediaId" label="Image de couverture" />
      </div>

      <div class="admin-card">
        <div class="field">
          <label for="a-body">
            Texte
            <span class="count">
              — {{ preview.charCount }} caractères, {{ preview.readingMinutes }} min
            </span>
          </label>
          <textarea id="a-body" v-model="draft.bodyMd" spellcheck="false" rows="30" />
        </div>
      </div>
    </div>

    <section class="admin-card a-attached">
      <h2>Publications liées</h2>
      <p class="admin-lede">
        Elles s'affichent sous l'article, au bas de la page publique.
      </p>

      <ul v-if="(attached ?? []).length" class="a-lines">
        <li v-for="p in attached ?? []" :key="p.id">
          <a v-if="p.permalink" class="a-title" :href="p.permalink" target="_blank" rel="noopener">
            {{ p.caption?.slice(0, 80) || 'Publication' }} ↗
          </a>
          <span v-else class="a-title">{{ p.caption?.slice(0, 80) || 'Publication' }}</span>
          <span class="a-tag is-info">{{ p.network }}</span>
        </li>
      </ul>
      <p v-else class="a-empty">Aucune publication liée à cet article.</p>

      <PostImportForm :article-slug="slug" @added="refreshAttached" />
    </section>

    <ArticlePreview
      v-if="previewOpen"
      :title="draft.title"
      :dek="draft.dek ?? ''"
      :html="preview.html"
      :cover-url="coverUrl"
      :cover-alt="draft.title"
      :tags="draft.tags"
      :byline="site?.identity.author"
      :published-at="null"
      :reading-minutes="preview.readingMinutes"
      @close="previewOpen = false"
    />
  </div>
</template>
