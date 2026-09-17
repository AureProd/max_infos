<script setup lang="ts">
import { networkLabel } from '#shared/utils/social'

/**
 * Importing a post by hand, from its address.
 *
 * The ONLY way in for LinkedIn: reading one's own posts there is
 * impossible, `r_member_social` having been closed to new applications —
 * verified in September 2026, and not to be relearnt.
 *
 * Lives in its own component because the article editor needs the very same
 * form, already pointed at the article being written. Two copies of a form
 * that posts to the same route would drift apart on the first fix.
 */
const props = withDefaults(defineProps<{ articleSlug?: string | null }>(), { articleSlug: null })
const emit = defineEmits<{ added: [] }>()

const { ok, fail } = useNotify()

const BLANK = {
  network: 'linkedin' as 'linkedin' | 'instagram',
  url: '',
  caption: '',
  thumbnailUrl: '',
}

const input = ref({ ...BLANK })

/**
 * What the pasted page says about itself.
 *
 * The server reads the OpenGraph tags of the link. LinkedIn serves them
 * unevenly: when it says nothing, the two fields simply stay there, empty
 * and editable — which is why they are always shown, rather than appearing
 * on failure.
 */
const reading = ref(false)
const readingSaid = ref('')
const sending = ref(false)

async function readLink(): Promise<void> {
  const url = input.value.url.trim()
  if (!url) return
  reading.value = true
  readingSaid.value = ''
  try {
    const found = await $fetch('/api/admin/social-posts/unfurl', { method: 'POST', body: { url } })
    if (found.title && !input.value.caption) input.value.caption = found.title
    if (found.image && !input.value.thumbnailUrl) input.value.thumbnailUrl = found.image
    readingSaid.value =
      found.title || found.image
        ? 'Lu depuis la page. Le titre reste modifiable.'
        : 'Cette page ne dit rien d’exploitable : à remplir à la main.'
  } catch (e) {
    fail(e, 'Lecture de la page impossible')
  } finally {
    reading.value = false
  }
}

async function add(): Promise<void> {
  sending.value = true
  try {
    const created = await $fetch<{ id: number }>('/api/admin/social-posts', {
      method: 'POST',
      body: {
        network: input.value.network,
        url: input.value.url,
        // Empty strings would fail the URL and length checks: absent means
        // absent.
        caption: input.value.caption || undefined,
        thumbnailUrl: input.value.thumbnailUrl || undefined,
      },
    })

    // Depuis l'écran d'un article, la publication lui est rattachée dans la
    // foulée : c'est la seule raison de l'importer depuis là.
    if (props.articleSlug) {
      await $fetch<unknown>(`/api/admin/social-posts/${created.id}/article`, {
        method: 'PUT',
        body: { articleSlug: props.articleSlug },
      })
    }

    input.value = { ...BLANK }
    readingSaid.value = ''
    emit('added')
    ok(props.articleSlug ? 'Publication rattachée à l’article' : 'Publication ajoutée')
  } catch (e) {
    fail(e, 'Adresse non reconnue')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="a-import" @submit.prevent="add">
    <!--
      Une grille, et non une barre en flex : les champs y avaient des
      hauteurs différentes selon qu'ils portaient un <input> nu ou un
      contrôle de la bibliothèque, et rien ne s'alignait.
    -->
    <div class="a-import-grid">
      <div class="field">
        <span class="a-label">Réseau</span>
        <!--
          Deux options, donc deux segments visibles plutôt qu'un menu à
          dérouler : le réseau se change d'un geste, et l'on voit celui qui
          est choisi sans ouvrir quoi que ce soit.
        -->
        <div class="a-seg" role="group" aria-label="Réseau">
          <button
            v-for="r in (['linkedin', 'instagram'] as const)"
            :key="r"
            type="button"
            :aria-pressed="input.network === r"
            @click="input.network = r"
          >
            <i :class="['pi', r === 'linkedin' ? 'pi-linkedin' : 'pi-instagram']" aria-hidden="true" />
            {{ networkLabel(r) }}
          </button>
        </div>
      </div>

      <div class="field a-import-url">
        <label for="p-url">Adresse de la publication</label>
        <InputText
          id="p-url"
          v-model="input.url"
          type="url"
          placeholder="https://www.linkedin.com/posts/…"
          required
          fluid
          @blur="readLink"
        />
      </div>

      <!--
        Toujours affichés, jamais seulement en cas d'échec : LinkedIn ne
        sert ses balises qu'une fois sur deux, et un champ qui apparaît par
        surprise se remarque moins qu'un champ vide qui attend.

        Dans leur propre grille : la rangée du dessus a une première colonne
        taillée sur le mot « Réseau », et le titre s'y retrouvait à trente
        pixels de large.
      -->
      <div class="a-import-pair">
        <div class="field">
          <label for="p-caption">Titre ou légende</label>
          <InputText id="p-caption" v-model="input.caption" type="text" fluid />
        </div>

        <div class="field">
          <label for="p-thumb">Adresse de l'image</label>
          <InputText id="p-thumb" v-model="input.thumbnailUrl" type="url" fluid />
        </div>
      </div>
    </div>

    <div class="a-import-actions">
      <Button
        severity="secondary"
        outlined
        type="button"
        class="a-btn-block"
        icon="pi pi-download"
        :label="reading ? 'Lecture…' : 'Récupérer le titre et l’image'"
        :disabled="reading || !input.url"
        @click="readLink"
      />
      <Button
        type="submit"
        icon="pi pi-plus"
        :label="articleSlug ? 'Ajouter et rattacher' : 'Ajouter'"
        :disabled="sending || !input.url"
      />
    </div>

    <p v-if="readingSaid" class="hint">{{ readingSaid }}</p>
  </form>
</template>
