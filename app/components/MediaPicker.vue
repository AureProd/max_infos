<script setup lang="ts">
/**
 * Picking an image: existing library or upload.
 *
 * The upload happens IN TWO STEPS: the server records the medium and
 * returns a signed URL, then the browser sends the file straight to R2. The
 * file never crosses Nitro — container memory does not grow with image
 * size, and the server does not become an open relay.
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

    // Direct send to R2. The Content-Type must be EXACTLY the one signed,
    // otherwise R2 refuses the request — the signature covers it.
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
