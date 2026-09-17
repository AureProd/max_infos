<script setup lang="ts">
/**
 * Choosing a file: the library, an upload, or a drop.
 *
 * Replaces the old picker, which showed a `<select>` of file NAMES. Choosing
 * a cover meant reading « 4f2a-bretagne-1080.png » and hoping — for the one
 * screen where what matters is what the image looks like. Here the library
 * is a grid of thumbnails, and the chosen file is shown, not named.
 *
 * The upload happens IN TWO STEPS: the server records the medium and returns
 * a signed URL, then the browser sends the file straight to R2. The file
 * never crosses Nitro — container memory does not grow with image size, and
 * the server does not become an open relay.
 */
interface Media {
  id: number
  url: string
  alt: string | null
  kind: 'image' | 'pdf'
  mime: string
}

const model = defineModel<number | null>({ default: null })
const props = withDefaults(
  defineProps<{ kind?: 'image' | 'pdf'; label?: string; hint?: string }>(),
  { kind: 'image', label: 'Image', hint: '' },
)

const { data, refresh } = await useFetch<{ items: Media[]; stockage: boolean }>(
  '/api/admin/media',
  { key: `media-${props.kind}`, headers: sessionHeaders() },
)

const { fail } = useNotify()

const available = computed(() => (data.value?.items ?? []).filter((m) => m.kind === props.kind))
const chosen = computed(() => available.value.find((m) => m.id === model.value) ?? null)

const gallery = ref(false)
const zoom = ref(false)
const sending = ref(false)
const dragging = ref(false)

/** The file name, which says more than a MIME type when checking an upload. */
const fileName = (m: Media): string =>
  m.alt || decodeURIComponent(m.url.split('/').pop() ?? '') || m.mime

async function send(file: File | undefined): Promise<void> {
  if (!file) return

  sending.value = true
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
  } catch (e) {
    fail(e, 'Envoi impossible')
  } finally {
    sending.value = false
  }
}

function onPick(event: Event): void {
  void send((event.target as HTMLInputElement).files?.[0])
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  void send(event.dataTransfer?.files?.[0])
}

const accept = computed(() => (props.kind === 'pdf' ? 'application/pdf' : 'image/*'))
</script>

<template>
  <div class="field">
    <span class="a-label">{{ label }}</span>
    <p v-if="hint" class="hint">{{ hint }}</p>

    <p v-if="data && !data.stockage" class="a-err">
      Le stockage n'est pas configuré : renseigner les variables NUXT_R2_* pour téléverser.
    </p>

    <!--
      Une zone unique : ce qui est choisi, et le geste pour en changer. Le
      fichier se dépose dessus — c'est le geste que tout le monde essaie en
      premier, et il ne faisait rien.
    -->
    <div
      :class="['a-media', dragging && 'is-dragging']"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <template v-if="chosen">
        <button
          type="button"
          class="a-media-thumb"
          :aria-label="`Agrandir ${fileName(chosen)}`"
          @click="zoom = true"
        >
          <img v-if="chosen.kind === 'image'" :src="chosen.url" :alt="chosen.alt ?? ''" />
          <span v-else class="a-media-pdf"><i class="pi pi-file-pdf" aria-hidden="true" /></span>
        </button>

        <div class="a-media-side">
          <span class="a-media-name">{{ fileName(chosen) }}</span>
          <div class="a-row-act">
            <Button
              severity="secondary"
              outlined
              size="small"
              icon="pi pi-images"
              label="Changer"
              @click="gallery = true"
            />
            <Button
              v-tooltip.top="'Retirer'"
              severity="danger"
              outlined
              size="small"
              icon="pi pi-trash"
              aria-label="Retirer"
              @click="model = null"
            />
          </div>
        </div>
      </template>

      <div v-else class="a-media-empty">
        <i class="pi pi-image" aria-hidden="true" />
        <p>Dépose un fichier ici, ou choisis-en un.</p>
        <div class="a-row-act">
          <Button
            severity="secondary"
            outlined
            size="small"
            icon="pi pi-images"
            label="La médiathèque"
            :disabled="!available.length"
            @click="gallery = true"
          />
          <label class="a-btn a-btn-primary">
            <i class="pi pi-upload" aria-hidden="true" />
            {{ sending ? 'Envoi…' : 'Téléverser' }}
            <input
              type="file"
              :accept="accept"
              :disabled="sending || !data?.stockage"
              hidden
              @change="onPick"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- La médiathèque : des vignettes, pas des noms de fichiers. -->
    <Dialog
      v-model:visible="gallery"
      modal
      :header="label"
      :style="{ width: '52rem', maxWidth: 'calc(100vw - 2rem)' }"
      :pt="{ root: { class: 'admin-ui' } }"
    >
      <p v-if="!available.length" class="a-empty">Aucun fichier de ce type pour l'instant.</p>

      <ul v-else class="a-gallery">
        <li v-for="m in available" :key="m.id">
          <button
            type="button"
            :class="['a-gallery-item', m.id === model && 'is-on']"
            :aria-pressed="m.id === model"
            @click="((model = m.id), (gallery = false))"
          >
            <img v-if="m.kind === 'image'" :src="m.url" :alt="m.alt ?? ''" loading="lazy" />
            <span v-else class="a-media-pdf"><i class="pi pi-file-pdf" aria-hidden="true" /></span>
            <span class="a-gallery-name">{{ fileName(m) }}</span>
          </button>
        </li>
      </ul>

      <template #footer>
        <label class="a-btn a-btn-primary">
          <i class="pi pi-upload" aria-hidden="true" />
          {{ sending ? 'Envoi…' : 'Téléverser un fichier' }}
          <input
            type="file"
            :accept="accept"
            :disabled="sending || !data?.stockage"
            hidden
            @change="onPick"
          />
        </label>
      </template>
    </Dialog>

    <!--
      L'aperçu en grand. Un PDF montrait son type MIME et rien d'autre :
      impossible de savoir si le fichier téléversé était le bon. Le
      navigateur sait rendre un PDF — autant le lui demander.
    -->
    <Dialog
      v-if="chosen"
      v-model:visible="zoom"
      modal
      dismissable-mask
      :header="fileName(chosen)"
      :style="{ width: '64rem', maxWidth: 'calc(100vw - 2rem)' }"
      :pt="{ root: { class: 'admin-ui' } }"
    >
      <img
        v-if="chosen.kind === 'image'"
        class="a-zoom-img"
        :src="chosen.url"
        :alt="chosen.alt ?? ''"
      />
      <object v-else :data="chosen.url" type="application/pdf" class="a-zoom-pdf">
        <!-- Replacement shown when the browser cannot display a PDF inline,
             on most phones in particular. -->
        <p class="a-preview-fallback">
          <a :href="chosen.url" target="_blank" rel="noopener">Ouvrir le PDF ↗</a>
        </p>
      </object>

      <template #footer>
        <a class="a-btn" :href="chosen.url" target="_blank" rel="noopener">
          <i class="pi pi-external-link" aria-hidden="true" /> Ouvrir dans un onglet
        </a>
      </template>
    </Dialog>
  </div>
</template>
