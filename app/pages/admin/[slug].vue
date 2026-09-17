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
const tagError = ref('')

const orphan = computed(() => {
  const byLabel = new Map((known.value ?? []).map((t) => [t.label, t]))
  return (label: string) => {
    const t = byLabel.get(label)
    return t !== undefined && t.n === 0 && !draft.value.tags.includes(label) ? t.slug : null
  }
})

async function dropTag(slug: string, label: string): Promise<void> {
  if (!confirm(`Supprimer définitivement le sujet « ${label} » ?`)) return
  tagError.value = ''
  try {
    await $fetch<unknown>(`/api/admin/tags/${slug}`, { method: 'DELETE' })
    known.value = (known.value ?? []).filter((t) => t.slug !== slug)
  } catch (e) {
    tagError.value = (e as { statusMessage?: string }).statusMessage ?? 'Suppression refusée'
  }
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
          <span v-if="record === 'en cours'"> · enregistrement…</span>
          <span v-else-if="record === 'échec'" class="a-err"> · échec de l'enregistrement</span>
          <span v-else-if="modified"> · modifications non enregistrées</span>
          <span v-else-if="record === 'enregistré'"> · enregistré</span>
        </p>
      </div>
      <div class="admin-actions">
        <button class="a-btn" type="button" @click="previewOpen = true">Aperçu</button>
        <button class="a-btn" type="button" @click="save">Enregistrer</button>
        <button
          v-if="status === 'draft'"
          class="a-btn a-btn-primary"
          type="button"
          @click="changeStatus('published')"
        >
          Publier
        </button>
        <button v-else class="a-btn" type="button" @click="changeStatus('draft')">
          Dépublier
        </button>
      </div>
    </div>

    <div class="a-editor">
      <div class="admin-card">
          <div class="field">
            <label for="a-title">Titre</label>
            <input id="a-title" v-model="draft.title" type="text" />
          </div>
          <div class="field">
            <label for="a-dek">Chapô</label>
            <input id="a-dek" v-model="draft.dek" type="text" />
          </div>
          <div class="field">
            <span class="a-label">Sujets</span>
            <div class="a-chosen">
              <button
                v-for="t in draft.tags"
                :key="t"
                class="a-chip is-on"
                type="button"
                :title="`Retirer « ${t} »`"
                @click="removeTag(t)"
              >
                {{ t }} ×
              </button>
              <Button
                severity="secondary"
                outlined
                size="small"
                :label="draft.tags.length ? 'Modifier' : 'Choisir les sujets'"
                @click="picking = true"
              />
            </div>
          </div>

          <Dialog
            v-model:visible="picking"
            modal
            header="Sujets de l'article"
            :style="{ width: '32rem' }"
          >
            <p class="hint">
              Coche ceux qui existent déjà. Un sujet ne se crée que s'il ne ressemble à aucun
              autre — c'est ce qui empêche « Histoire » et « histoire » de cohabiter.
            </p>

            <InputText
              v-model="search"
              class="a-tagsearch"
              placeholder="Chercher ou créer un sujet"
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

            <p v-if="tagError" class="a-err">{{ tagError }}</p>

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
                  Le bouton ne paraît que sur un sujet qu'aucun article ne
                  porte : ailleurs, supprimer voudrait dire le retirer des
                  articles, ce que personne ne demande depuis cet écran.
                -->
                <Button
                  v-if="orphan(label)"
                  class="a-tagdrop"
                  severity="danger"
                  text
                  size="small"
                  label="Supprimer"
                  :title="`Aucun article ne porte « ${label} »`"
                  @click="dropTag(orphan(label) as string, label)"
                />
              </li>
              <li v-if="!choices.length && !isNew" class="a-nil">Aucun sujet pour l'instant.</li>
            </ul>

            <template #footer>
              <Button label="Fermer" @click="picking = false" />
            </template>
          </Dialog>
        <MediaPicker v-model="draft.coverMediaId" label="Image de couverture" />
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

    <VariantsPanel :slug="slug ?? ''" :publie="status === 'published'" />

    <ArticlePreview
      v-if="previewOpen"
      :title="draft.title"
      :dek="draft.dek ?? ''"
      :html="preview.html"
      :cover-url="coverUrl"
      :cover-alt="draft.title"
      :tags="draft.tags"
      :byline="site?.identity.byline"
      :published-at="null"
      :reading-minutes="preview.readingMinutes"
      @close="previewOpen = false"
    />
  </div>
</template>
