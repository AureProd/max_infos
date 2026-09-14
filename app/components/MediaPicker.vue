<script setup lang="ts">
/**
 * Choix d'une image : bibliothèque existante ou téléversement.
 *
 * Le téléversement se fait EN DEUX TEMPS : le serveur enregistre le média
 * et renvoie une URL signée, puis le navigateur envoie le fichier
 * directement à R2. Le fichier ne traverse jamais Nitro — la mémoire du
 * conteneur ne monte pas avec la taille des images, et le serveur ne
 * devient pas un relais ouvert.
 */
interface Media {
  id: number
  url: string
  alt: string | null
  kind: 'image' | 'pdf'
  mime: string
}

const modele = defineModel<number | null>({ default: null })
const props = withDefaults(defineProps<{ genre?: 'image' | 'pdf'; libelle?: string }>(), {
  genre: 'image',
  libelle: 'Image',
})

const { data, refresh } = await useFetch<{ items: Media[]; stockage: boolean }>(
  '/api/admin/media',
  { key: 'media-picker', headers: enTetesDeSession() },
)

const disponibles = computed(() => (data.value?.items ?? []).filter((m) => m.kind === props.genre))
const choisi = computed(() => disponibles.value.find((m) => m.id === modele.value) ?? null)

const etat = ref<'repos' | 'envoi' | 'échec'>('repos')
const erreur = ref('')

async function televerser(evenement: Event): Promise<void> {
  const fichier = (evenement.target as HTMLInputElement).files?.[0]
  if (!fichier) return

  etat.value = 'envoi'
  erreur.value = ''
  try {
    const { media, uploadUrl } = await $fetch<{
      media: { id: number; url: string }
      uploadUrl: string
    }>('/api/admin/media/upload-url', {
      method: 'POST',
      body: { filename: fichier.name, contentType: fichier.type, bytes: fichier.size },
    })

    // Envoi direct à R2. Le Content-Type doit être EXACTEMENT celui signé,
    // sinon R2 refuse la requête — la signature le couvre.
    const reponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fichier,
      headers: { 'content-type': fichier.type },
    })
    if (!reponse.ok) throw new Error(`Le stockage a refusé le fichier (${reponse.status})`)

    modele.value = media.id
    await refresh()
    etat.value = 'repos'
  } catch (e) {
    etat.value = 'échec'
    erreur.value =
      (e as { statusMessage?: string }).statusMessage ?? (e as Error).message ?? 'Envoi impossible'
  }
}
</script>

<template>
  <div class="field">
    <span class="label">{{ libelle }}</span>

    <p v-if="data && !data.stockage" class="err">
      Le stockage n'est pas configuré : renseigner les variables NUXT_R2_* pour téléverser.
    </p>

    <div v-if="choisi" class="cluster" style="margin-bottom: 10px">
      <img
        v-if="choisi.kind === 'image'"
        :src="choisi.url"
        :alt="choisi.alt ?? ''"
        style="width: 90px; height: 112px; object-fit: cover; border-radius: 3px"
      />
      <span v-else class="pill">{{ choisi.mime }}</span>
      <button class="btn" type="button" @click="modele = null">Retirer</button>
    </div>

    <div class="cluster">
      <select
        :value="modele ?? ''"
        :aria-label="`Choisir : ${libelle}`"
        @change="modele = Number(($event.target as HTMLSelectElement).value) || null"
      >
        <option value="">— aucune —</option>
        <option v-for="m in disponibles" :key="m.id" :value="m.id">
          {{ m.alt || m.url.split('/').pop() }}
        </option>
      </select>

      <label class="btn">
        {{ etat === 'envoi' ? 'Envoi…' : 'Téléverser' }}
        <input
          type="file"
          :accept="genre === 'pdf' ? 'application/pdf' : 'image/*'"
          :disabled="etat === 'envoi' || !data?.stockage"
          style="display: none"
          @change="televerser"
        />
      </label>
    </div>

    <p v-if="erreur" class="err">{{ erreur }}</p>
  </div>
</template>
