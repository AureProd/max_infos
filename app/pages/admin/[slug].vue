<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const slug = ref<string | null>(String(route.params.slug))

const { draft, preview, status, record, modified, load, save, changeStatus } = useDraft(slug)

await load()

const tags = computed({
  get: () => draft.value.tags.join(', '),
  set: (v: string) => {
    draft.value.tags = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
})

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
  <div class="wrap">
    <section class="admin-page">
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
            <input id="a-tags" v-model="tags" type="text" />
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
    </section>
  </div>
</template>
