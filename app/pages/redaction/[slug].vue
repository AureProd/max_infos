<script setup lang="ts">
definePageMeta({ middleware: 'redaction' })

const route = useRoute()
const slug = ref<string | null>(String(route.params.slug))

const { brouillon, apercu, statut, enregistrement, modifie, charger, enregistrer, changerStatut } =
  useBrouillon(slug)

await charger()

const sujets = computed({
  get: () => brouillon.value.tags.join(', '),
  set: (v: string) => {
    brouillon.value.tags = v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
})

// Enregistrement automatique : Max écrit, il n'a pas à penser à sauvegarder.
let minuteur: ReturnType<typeof setTimeout> | undefined
watch(modifie, (change) => {
  if (!change) return
  clearTimeout(minuteur)
  minuteur = setTimeout(enregistrer, 1500)
})

// Un départ de page avec des modifications non parties perdrait du texte.
onBeforeRouteLeave(async () => {
  if (modifie.value) await enregistrer()
})

useSeoMeta({ title: () => `${brouillon.value.title} — Rédaction`, robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <div class="admin-bar">
        <h1>
          <NuxtLink to="/redaction">←</NuxtLink>
          {{ brouillon.title || 'Sans titre' }}
        </h1>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <span class="pill">{{ statut === 'published' ? 'publié' : 'brouillon' }}</span>
          <span v-if="enregistrement === 'en cours'" class="note">enregistrement…</span>
          <span v-else-if="enregistrement === 'échec'" class="err">échec de l'enregistrement</span>
          <span v-else-if="modifie" class="note">modifications non enregistrées</span>
          <span v-else-if="enregistrement === 'enregistré'" class="note">enregistré</span>

          <button class="btn" type="button" @click="enregistrer">Enregistrer</button>
          <button
            v-if="statut === 'draft'"
            class="btn btn-primary"
            type="button"
            @click="changerStatut('published')"
          >
            Publier
          </button>
          <button v-else class="btn" type="button" @click="changerStatut('draft')">
            Dépublier
          </button>
        </div>
      </div>

      <div class="editor">
        <div>
          <div class="field">
            <label for="a-title">Titre</label>
            <input id="a-title" v-model="brouillon.title" type="text" />
          </div>
          <div class="field">
            <label for="a-dek">Chapô</label>
            <input id="a-dek" v-model="brouillon.dek" type="text" />
          </div>
          <div class="field">
            <label for="a-tags">Sujets, séparés par des virgules</label>
            <input id="a-tags" v-model="sujets" type="text" />
          </div>
          <MediaPicker v-model="brouillon.coverMediaId" libelle="Image de couverture" />
          <div class="field">
            <label for="a-body">
              Texte
              <span class="count">
                — {{ apercu.charCount }} caractères, {{ apercu.readingMinutes }} min
              </span>
            </label>
            <textarea id="a-body" v-model="brouillon.bodyMd" spellcheck="false" />
          </div>
        </div>
        <div class="preview">
          <!--
            Le HTML vient du SERVEUR, rendu et assaini par le même moteur que
            l'enregistrement. Ce que Max voit ici est exactement ce qui sera
            publié. app/pages/redaction/[slug].vue est inscrit dans la liste
            autorisée de scripts/hooks/check-v-html.sh pour cette raison.
          -->
          <div class="prose" v-html="apercu.html" />
        </div>
      </div>

      <DeclinerPanneau :slug="slug ?? ''" :publie="statut === 'published'" />
    </section>
  </div>
</template>
