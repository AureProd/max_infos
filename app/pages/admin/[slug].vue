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

useSeoMeta({ title: () => `${draft.value.title} — Rédaction`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
      <div class="admin-bar">
        <h1>
          <NuxtLink to="/admin">←</NuxtLink>
          {{ draft.title || 'Sans titre' }}
        </h1>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <span class="pill">{{ status === 'published' ? 'publié' : 'brouillon' }}</span>
          <span v-if="record === 'en cours'" class="note">enregistrement…</span>
          <span v-else-if="record === 'échec'" class="err">échec de l'enregistrement</span>
          <span v-else-if="modified" class="note">modifications non enregistrées</span>
          <span v-else-if="record === 'enregistré'" class="note">enregistré</span>

          <button class="btn" type="button" @click="save">Enregistrer</button>
          <button
            v-if="status === 'draft'"
            class="btn btn-primary"
            type="button"
            @click="changeStatus('published')"
          >
            Publier
          </button>
          <button v-else class="btn" type="button" @click="changeStatus('draft')">
            Dépublier
          </button>
        </div>
      </div>

      <div class="editor">
        <div>
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
          <div class="field">
            <label for="a-body">
              Texte
              <span class="count">
                — {{ preview.charCount }} caractères, {{ preview.readingMinutes }} min
              </span>
            </label>
            <textarea id="a-body" v-model="draft.bodyMd" spellcheck="false" />
          </div>
        </div>
        <div class="preview">
          <!--
            Le HTML vient du SERVEUR, rendu et assaini par le même moteur que
            l'enregistrement. Ce que Max voit ici est exactement ce qui sera
            publié. app/pages/admin/[slug].vue est inscrit dans la liste
            autorisée de scripts/hooks/check-v-html.sh pour cette reason.
          -->
          <div class="prose" v-html="preview.html" />
        </div>
      </div>

      <VariantsPanel :slug="slug ?? ''" :publie="status === 'published'" />
  </div>
</template>
