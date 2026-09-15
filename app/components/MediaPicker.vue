<script setup lang="ts">
/**
 * Choix d'une image : bibliothèque existante ou téléversement.
 *
 * Le téléversement se fait EN DEUX TEMPS : le serveur enregistre le média
 * et renvoie une URL signée, then le navigateur envoie le file
 * directement à R2. Le file ne traverse jamais Nitro — la mémoire du
 * conteneur ne monte pas avec la size des images, et le serveur ne
 * devient pas un relais ouvert.
 */
interface Media {
  id: number
  url: string
  alt: string | null
  kind: 'image' | 'pdf'
  mime: string
}

const model = defineModel<number | null>({ default: null })
const props = withDefaults(defineProps<{ kind?: 'image' | 'pdf'; label?: string }>(), {
  kind: 'image',
  label: 'Image',
})

const { data, refresh } = await useFetch<{ items: Media[]; stockage: boolean }>(
  '/api/admin/media',
  { key: 'media-picker', headers: sessionHeaders() },
)

const available = computed(() => (data.value?.items ?? []).filter((m) => m.kind === props.kind))
const chosen = computed(() => available.value.find((m) => m.id === model.value) ?? null)

const state = ref<'repos' | 'envoi' | 'échec'>('repos')
const error = ref('')

async function upload(evenement: Event): Promise<void> {
  const file = (evenement.target as HTMLInputElement).files?.[0]
  if (!file) return

  state.value = 'envoi'
  error.value = ''
  try {
    const { media, uploadUrl } = await $fetch<{
      media: { id: number; url: string }
      uploadUrl: string
    }>('/api/admin/media/upload-url', {
      method: 'POST',
      body: { filename: file.name, contentType: file.type, bytes: file.size },
    })

    // Envoi direct à R2. Le Content-Type doit être EXACTEMENT celui signé,
    // sinon R2 refuse la requête — la signature le couvre.
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type },
    })
    if (!response.ok) throw new Error(`Le stockage a refusé le fichier (${response.status})`)

    model.value = media.id
    await refresh()
    state.value = 'repos'
  } catch (e) {
    state.value = 'échec'
    error.value =
      (e as { statusMessage?: string }).statusMessage ?? (e as Error).message ?? 'Envoi impossible'
  }
}
</script>

<template>
  <div class="field">
    <span class="label">{{ label }}</span>

    <p v-if="data && !data.stockage" class="err">
      Le stockage n'est pas configuré : renseigner les variables NUXT_R2_* pour téléverser.
    </p>

    <div v-if="chosen" class="cluster" style="margin-bottom: 10px">
      <img
        v-if="chosen.kind === 'image'"
        :src="chosen.url"
        :alt="chosen.alt ?? ''"
        style="width: 90px; height: 112px; object-fit: cover; border-radius: 3px"
      />
      <span v-else class="pill">{{ chosen.mime }}</span>
      <button class="btn" type="button" @click="model = null">Retirer</button>
    </div>

    <div class="cluster">
      <select
        :value="model ?? ''"
        :aria-label="`Choisir : ${label}`"
        @change="model = Number(($event.target as HTMLSelectElement).value) || null"
      >
        <option value="">— aucune —</option>
        <option v-for="m in available" :key="m.id" :value="m.id">
          {{ m.alt || m.url.split('/').pop() }}
        </option>
      </select>

      <label class="btn">
        {{ state === 'envoi' ? 'Envoi…' : 'Téléverser' }}
        <input
          type="file"
          :accept="kind === 'pdf' ? 'application/pdf' : 'image/*'"
          :disabled="state === 'envoi' || !data?.stockage"
          style="display: none"
          @change="upload"
        />
      </label>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>
