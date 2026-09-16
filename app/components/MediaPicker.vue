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

/** The file name, which says more than a MIME type when checking an upload. */
const fileName = computed(() => {
  const c = chosen.value
  if (!c) return ''
  return c.alt || decodeURIComponent(c.url.split('/').pop() ?? '') || c.mime
})

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
    let response: Response
    try {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
    } catch {
      // A preflight the bucket refuses surfaces as a bare TypeError: no
      // status, no message, nothing in our logs — the request never left.
      // Naming CORS here saves the next hour spent reading the console.
      throw new Error(
        "Le stockage a refusé la connexion : la règle CORS du seau n'autorise pas ce site (pnpm r2:cors).",
      )
    }
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

    <div v-if="chosen" class="a-preview">
      <img
        v-if="chosen.kind === 'image'"
        :src="chosen.url"
        :alt="chosen.alt ?? ''"
        class="a-preview-img"
      />

      <!--
        Un PDF montrait son type MIME et rien d'autre : impossible de savoir
        si le fichier téléversé était le bon, ni même s'il s'était ouvert.
        Le navigateur sait rendre un PDF — autant le lui demander.
      -->
      <object v-else :data="chosen.url" type="application/pdf" class="a-preview-pdf">
        <!-- Replacement shown when the browser cannot display a PDF inline,
             on most phones in particular. -->
        <p class="a-preview-fallback">
          <a :href="chosen.url" target="_blank" rel="noopener">Ouvrir le PDF ↗</a>
        </p>
      </object>

      <div class="a-preview-side">
        <span class="a-preview-name">{{ fileName }}</span>
        <a class="a-btn" :href="chosen.url" target="_blank" rel="noopener">Ouvrir ↗</a>
        <button class="a-btn" type="button" @click="model = null">Retirer</button>
      </div>
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
