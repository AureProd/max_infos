<script setup lang="ts">
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

const unused = computed(() =>
  (known.value ?? []).filter((t) => !draft.value.tags.includes(t.label)),
)

function addTag(label: string): void {
  if (!draft.value.tags.includes(label)) draft.value.tags = [...draft.value.tags, label]
}

function removeTag(label: string): void {
  draft.value.tags = draft.value.tags.filter((t) => t !== label)
}

/**
 * The free-text field, kept alongside: a brand-new subject must not require
 * an existing tag. It is only reformatted when it loses focus — reformatting
 * on every keystroke made the caret jump over the typed comma.
 */
const tagsInput = ref(draft.value.tags.join(', '))
watch(
  () => draft.value.tags,
  (list) => {
    tagsInput.value = list.join(', ')
  },
)
function commitTags(): void {
  draft.value.tags = tagsInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
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
            <label for="a-tags">Sujets, séparés par des virgules</label>
            <input
              id="a-tags"
              v-model="tagsInput"
              type="text"
              @change="commitTags"
              @blur="commitTags"
            />

            <div v-if="draft.tags.length" class="a-chosen">
              <button
                v-for="t in draft.tags"
                :key="t"
                class="a-chip is-on"
                type="button"
                @click="removeTag(t)"
              >
                {{ t }} ×
              </button>
            </div>

            <div v-if="unused.length" class="a-known">
              <span class="a-known-label">Déjà utilisés :</span>
              <button
                v-for="t in unused"
                :key="t.slug"
                class="a-chip"
                type="button"
                @click="addTag(t.label)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
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
