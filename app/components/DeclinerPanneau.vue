<script setup lang="ts">
/**
 * Aide à la déclinaison d'un article publié.
 *
 * Le site NE PUBLIE JAMAIS : il prépare un texte que Max copie, colle et
 * publie lui-même. Puis il recolle ici l'adresse de sa publication, ce qui
 * crée la liaison — seule voie possible pour LinkedIn, dont la découverte
 * automatique est hors de portée.
 */
const props = defineProps<{ slug: string; publie: boolean }>()

const { data: modeles, refresh: rechargerModeles } = await useFetch<{
  variables: readonly string[]
  linkedin: string
  reel: string
}>(() => `/api/admin/articles/${props.slug}/declinaisons`, {
  key: () => `declinaisons-${props.slug}`,
  headers: enTetesDeSession(),
  immediate: false,
})

watch(
  () => props.publie,
  (p) => {
    if (p) rechargerModeles()
  },
  { immediate: true },
)

const copie = ref<'linkedin' | 'reel' | null>(null)

async function copier(quoi: 'linkedin' | 'reel'): Promise<void> {
  const texte = quoi === 'linkedin' ? modeles.value?.linkedin : modeles.value?.reel
  if (!texte) return
  await navigator.clipboard.writeText(texte)
  copie.value = quoi
  setTimeout(() => {
    copie.value = null
  }, 2000)
}

// --- Recoller l'adresse de la publication ---------------------------------
const url = ref('')
const reseau = ref<'linkedin' | 'instagram'>('linkedin')
const etat = ref<'repos' | 'envoi' | 'lié' | 'échec'>('repos')
const erreur = ref('')

async function rattacher(): Promise<void> {
  etat.value = 'envoi'
  erreur.value = ''
  try {
    const cree = await $fetch<{ id: number }>('/api/admin/social-posts', {
      method: 'POST',
      body: { network: reseau.value, url: url.value },
    })
    await $fetch(`/api/admin/social-posts/${cree.id}/article`, {
      method: 'PUT',
      body: { articleSlug: props.slug },
    })
    etat.value = 'lié'
    url.value = ''
  } catch (e) {
    etat.value = 'échec'
    erreur.value = (e as { statusMessage?: string }).statusMessage ?? 'Adresse non reconnue.'
  }
}
</script>

<template>
  <section class="section">
    <div class="section-head">
      <h2>Décliner</h2>
      <span class="rule" />
    </div>

    <p v-if="!publie" class="hint">
      Les squelettes s'affichent une fois l'article publié : ils contiennent son adresse.
    </p>

    <template v-else-if="modeles">
      <div class="field">
        <label for="d-linkedin">
          Post LinkedIn
          <button class="btn" type="button" @click="copier('linkedin')">
            {{ copie === 'linkedin' ? 'copié ✓' : 'copier' }}
          </button>
        </label>
        <textarea id="d-linkedin" :value="modeles.linkedin" rows="10" readonly />
      </div>

      <div class="field">
        <label for="d-reel">
          Script de reel
          <button class="btn" type="button" @click="copier('reel')">
            {{ copie === 'reel' ? 'copié ✓' : 'copier' }}
          </button>
        </label>
        <textarea id="d-reel" :value="modeles.reel" rows="8" readonly />
      </div>

      <p class="hint">
        Variables disponibles dans les gabarits : {{ modeles.variables.join(', ') }}. Les
        modifier se fait depuis l'écran À propos.
      </p>

      <div class="field">
        <label for="d-url">Une fois publié, coller l'adresse ici</label>
        <div class="cluster">
          <select v-model="reseau" aria-label="Réseau">
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            id="d-url"
            v-model="url"
            type="url"
            placeholder="https://www.linkedin.com/posts/…"
          />
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!url || etat === 'envoi'"
            @click="rattacher"
          >
            Rattacher
          </button>
        </div>
        <p v-if="etat === 'lié'" class="note">Publication rattachée à cet article.</p>
        <p v-if="erreur" class="err">{{ erreur }}</p>
      </div>
    </template>
  </section>
</template>
