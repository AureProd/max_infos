<script setup lang="ts">
/**
 * Helps turn a published article into social variants.
 *
 * The site NEVER PUBLISHES: it prepares a text Max copies, pastes and
 * publishes himself. He then pastes the address of his post back here,
 * which creates the link — the only possible path for LinkedIn, whose
 * automatic discovery is out of reach.
 */
const props = defineProps<{ slug: string; publie: boolean }>()

const { data: models, refresh: rechargerModeles } = await useFetch<{
  variables: readonly string[]
  linkedin: string
  reel: string
}>(() => `/api/admin/articles/${props.slug}/variants`, {
  key: () => `declinaisons-${props.slug}`,
  headers: sessionHeaders(),
  immediate: false,
})

watch(
  () => props.publie,
  (p) => {
    if (p) rechargerModeles()
  },
  { immediate: true },
)

const copied = ref<'linkedin' | 'reel' | null>(null)

async function copy(quoi: 'linkedin' | 'reel'): Promise<void> {
  const text = quoi === 'linkedin' ? models.value?.linkedin : models.value?.reel
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = quoi
  setTimeout(() => {
    copied.value = null
  }, 2000)
}

// --- Pasting the post address back ----------------------------------------
const url = ref('')
const network = ref<'linkedin' | 'instagram'>('linkedin')
const state = ref<'repos' | 'envoi' | 'lié' | 'échec'>('repos')
const error = ref('')

async function attach(): Promise<void> {
  state.value = 'envoi'
  error.value = ''
  try {
    const created = await $fetch<{ id: number }>('/api/admin/social-posts', {
      method: 'POST',
      body: { network: network.value, url: url.value },
    })
    await $fetch(`/api/admin/social-posts/${created.id}/article`, {
      method: 'PUT',
      body: { articleSlug: props.slug },
    })
    state.value = 'lié'
    url.value = ''
  } catch (e) {
    state.value = 'échec'
    error.value = (e as { statusMessage?: string }).statusMessage ?? 'Adresse non reconnue.'
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

    <template v-else-if="models">
      <div class="field">
        <label for="d-linkedin">
          Post LinkedIn
          <button class="btn" type="button" @click="copy('linkedin')">
            {{ copied === 'linkedin' ? 'copié ✓' : 'copier' }}
          </button>
        </label>
        <textarea id="d-linkedin" :value="models.linkedin" rows="10" readonly />
      </div>

      <div class="field">
        <label for="d-reel">
          Script de reel
          <button class="btn" type="button" @click="copy('reel')">
            {{ copied === 'reel' ? 'copié ✓' : 'copier' }}
          </button>
        </label>
        <textarea id="d-reel" :value="models.reel" rows="8" readonly />
      </div>

      <p class="hint">
        Variables disponibles dans les gabarits : {{ models.variables.join(', ') }}. Les
        modifier se fait depuis l'écran À propos.
      </p>

      <div class="field">
        <label for="d-url">Une fois publié, coller l'adresse ici</label>
        <div class="cluster">
          <select v-model="network" aria-label="Réseau">
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
            :disabled="!url || state === 'envoi'"
            @click="attach"
          >
            Rattacher
          </button>
        </div>
        <p v-if="state === 'lié'" class="note">Publication rattachée à cet article.</p>
        <p v-if="error" class="err">{{ error }}</p>
      </div>
    </template>
  </section>
</template>
