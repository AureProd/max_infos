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

const NETWORKS = [
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Instagram', value: 'instagram' },
]

/**
 * The variable names, braces included, built HERE.
 *
 * Writing them in the template would nest the delimiters inside an
 * interpolation, and the Vue compiler reads the inner `{{` as the start of
 * an expression: « Unterminated string constant ».
 */
const variableNames = computed(() => (models.value?.variables ?? []).map((v) => `{{${v}}}`))

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
  <section class="admin-card a-variants">
    <h2>Décliner</h2>
    <p class="admin-lede">
      Le site ne publie jamais : il prépare un texte que tu copies, colles et publies
      toi-même.
    </p>

    <p v-if="!publie" class="a-empty">
      Les squelettes s'affichent une fois l'article publié : ils contiennent son adresse.
    </p>

    <template v-else-if="models">
      <div class="a-variant">
        <div class="a-variant-head">
          <span class="a-label">Post LinkedIn</span>
          <Button
            severity="secondary"
            outlined
            size="small"
            :label="copied === 'linkedin' ? 'copié ✓' : 'Copier'"
            @click="copy('linkedin')"
          />
        </div>
        <textarea id="d-linkedin" :value="models.linkedin" rows="11" readonly />
      </div>

      <div class="a-variant">
        <div class="a-variant-head">
          <span class="a-label">Script de reel</span>
          <Button
            severity="secondary"
            outlined
            size="small"
            :label="copied === 'reel' ? 'copié ✓' : 'Copier'"
            @click="copy('reel')"
          />
        </div>
        <textarea id="d-reel" :value="models.reel" rows="8" readonly />
      </div>

      <p class="hint">
        Variables des gabarits :
        <code v-for="v in variableNames" :key="v">{{ v }}</code>
        — ils se modifient depuis l'écran À propos.
      </p>

      <div class="a-variant">
        <span class="a-label">Une fois publié, coller l'adresse ici</span>
        <div class="a-toolbar">
          <Select
            v-model="network"
            :options="NETWORKS"
            option-label="label"
            option-value="value"
            aria-label="Réseau"
          />
          <input
            id="d-url"
            v-model="url"
            class="a-input"
            type="url"
            placeholder="https://www.linkedin.com/posts/…"
          />
          <Button
            label="Rattacher"
            :disabled="!url || state === 'envoi'"
            @click="attach"
          />
        </div>
        <p v-if="state === 'lié'" class="a-tag is-ok">Publication rattachée à cet article.</p>
        <p v-if="error" class="a-err">{{ error }}</p>
      </div>
    </template>
  </section>
</template>
