<script setup lang="ts">
import { nb } from '#shared/utils/format'

definePageMeta({ middleware: 'redaction' })

const { utilisateur, peut, deconnecter } = useUtilisateur()
// Ce qui relève de l'infrastructure n'apparaît pas dans le menu de Max.
// Ce masquage est du confort : la sécurité est le refus du serveur.
const voitLaTechnique = peut('tech')

/**
 * Aperçu du futur back-office. La prévisualisation est réelle ;
 * l'enregistrement sera branché sur l'API au lot 5.
 *
 * Cette page n'est PAS protégée : elle ne fait que manipuler un brouillon
 * dans le navigateur. La garde de route et les rôles arrivent au lot 4.
 */
// Un seul aller-retour : la liste sert juste à connaître le slug du
// dernier article, dont on charge ensuite le corps complet.
const { data: source } = await useAsyncData('redaction-source', async () => {
  const liste = await $fetch('/api/articles', { query: { taille: 1 } })
  const premier = liste.items[0]
  return premier ? await $fetch(`/api/articles/${premier.slug}`) : null
})

const draft = ref({ title: '', dek: '', tags: '', body: '' })

watch(
  source,
  (a) => {
    if (!a) return
    draft.value = {
      title: a.title,
      dek: a.dek ?? '',
      tags: a.tags.map((t) => t.label).join(', '),
      body: a.bodyMd,
    }
  },
  { immediate: true },
)

/**
 * L'aperçu vient du SERVEUR, par le même moteur que l'enregistrement.
 * Un rendu côté navigateur finirait par diverger de ce qui est publié —
 * et Max verrait autre chose que ses lecteurs.
 */
interface Apercu {
  html: string
  charCount: number
  readingMinutes: number
}

const apercu = ref<Apercu>({ html: '', charCount: 0, readingMinutes: 1 })
let minuteur: ReturnType<typeof setTimeout> | undefined

watch(
  () => draft.value.body,
  (corps) => {
    // Débattu : on n'envoie pas une requête à chaque frappe.
    clearTimeout(minuteur)
    minuteur = setTimeout(async () => {
      // Type annoté : l'inférence de routes de Nitro sature sur cette
      // chaîne d'appels imbriqués (« Excessive stack depth »).
      apercu.value = await $fetch<Apercu>('/api/admin/preview', {
        method: 'POST',
        body: { bodyMd: corps },
      })
    }, 300)
  },
  { immediate: true },
)

const preview = computed(() => apercu.value.html)
const length = computed(() => nb(apercu.value.charCount))

useSeoMeta({ title: 'Rédaction', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <div class="admin-bar">
        <h1>Rédaction</h1>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <span class="pill">{{ utilisateur?.name ?? utilisateur?.email }}</span>
          <NuxtLink v-if="voitLaTechnique" class="btn" to="/redaction/technique">
            Technique
          </NuxtLink>
          <button class="btn">Enregistrer le brouillon</button>
          <button class="btn btn-primary">Publier</button>
          <button class="btn" type="button" @click="deconnecter">Se déconnecter</button>
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
            <input id="a-tags" v-model="draft.tags" type="text" />
          </div>
          <div class="field">
            <label for="a-body"
              >Texte <span class="count">— {{ length }} caractères</span></label
            >
            <textarea id="a-body" v-model="draft.body" spellcheck="false" />
          </div>
        </div>
        <div class="preview">
          <!--
            v-html de l'aperçu Markdown, même moteur que la page d'article.
            Disparaît au lot 5, remplacé par un appel à l'API qui renverra
            du HTML déjà assaini côté serveur.
          -->
          <div class="prose" v-html="preview" />
        </div>
      </div>
    </section>
  </div>
</template>
