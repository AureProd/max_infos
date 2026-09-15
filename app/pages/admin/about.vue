<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const identity = useSetting('identity')
const contact = useSetting('contact')
const cv = useSetting('cv')

await Promise.all([identity.load(), contact.load(), cv.load()])

const state = computed(() =>
  [identity.state.value, contact.state.value, cv.state.value].includes('échec')
    ? 'échec'
    : [identity.state.value, contact.state.value, cv.state.value].every((e) => e === 'enregistré')
      ? 'enregistré'
      : 'repos',
)

async function saveAll(): Promise<void> {
  await Promise.all([identity.save(), contact.save(), cv.save()])
}

/**
 * The CV sections, in the order they appear.
 * Each section AND each entry carries its own switch.
 */
const SECTIONS = [
  { key: 'education' as const, label: 'Formations' },
  { key: 'experience' as const, label: 'Expériences' },
  { key: 'engagements' as const, label: 'Engagements' },
]

function addEntry(section: 'education' | 'experience' | 'engagements'): void {
  if (!cv.value.value) return
  cv.value.value[section].entries.push({ title: '', visible: true })
}

function removeEntry(section: 'education' | 'experience' | 'engagements', i: number): void {
  cv.value.value?.[section].entries.splice(i, 1)
}

/**
 * The contact fields whose publication deserves a second thought.
 *
 * The CV holds personal data that has no place on an indexed public page.
 * The warning shows when one of them is about to be made visible, not
 * afterwards.
 */
const SENSITIVE = /t[ée]l[ée]phone|adresse|naissance|portable|mobile|domicile/i

function isSensitive(field: { key: string; label: string; sensitive?: boolean }): boolean {
  return field.sensitive === true || SENSITIVE.test(`${field.key} ${field.label}`)
}

function addContact(): void {
  contact.value.value?.fields.push({
    key: '',
    label: '',
    value: '',
    // HIDDEN by default: a field added must not become public by
    // accident.
    visible: false,
    sensitive: false,
  })
}

useSeoMeta({ title: 'À propos', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="state === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="state === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="saveAll">Enregistrer</button>
      </AdminNav>

      <h1>À propos</h1>

      <h2>Identité du site</h2>
      <div v-if="identity.value.value">
        <div class="field">
          <label for="i-name">Nom du site</label>
          <input id="i-name" v-model="identity.value.value.name" type="text" />
        </div>
        <div class="field">
          <label for="i-author">Auteur</label>
          <input id="i-author" v-model="identity.value.value.author" type="text" />
        </div>
        <div class="field">
          <label for="i-byline">Signature courte</label>
          <input id="i-byline" v-model="identity.value.value.byline" type="text" />
        </div>
        <div class="field">
          <label for="i-tagline">Accroche</label>
          <input id="i-tagline" v-model="identity.value.value.tagline" type="text" />
        </div>
        <div class="field">
          <label for="i-pitch">Présentation</label>
          <textarea id="i-pitch" v-model="identity.value.value.pitch" rows="3" />
        </div>
      </div>

      <h2>Contact</h2>
      <p class="hint">
        Chaque champ a son propre interrupteur. Un champ ajouté est masqué par défaut.
      </p>
      <ul v-if="contact.value.value" class="list">
        <li v-for="(field, i) in contact.value.value.fields" :key="i">
          <div class="entry">
            <div style="flex: 1">
              <div class="cluster">
                <input v-model="field.label" type="text" placeholder="Libellé" />
                <input v-model="field.value" type="text" placeholder="Valeur" />
                <input v-model="field.href" type="text" placeholder="Lien (facultatif)" />
              </div>
              <p v-if="isSensitive(field) && field.visible" class="err">
                ⚠ Cette donnée personnelle sera publique et indexée par les moteurs de
                recherche. Elle restera consultable même après l'avoir retirée.
              </p>
            </div>
            <div class="cluster">
              <label class="pill">
                <input v-model="field.visible" type="checkbox" />
                visible
              </label>
              <button
                class="btn"
                type="button"
                @click="contact.value.value?.fields.splice(i, 1)"
              >
                Retirer
              </button>
            </div>
          </div>
        </li>
      </ul>
      <button class="btn" type="button" @click="addContact">+ Ajouter un champ</button>

      <template v-if="cv.value.value">
        <h2>Curriculum</h2>
        <div class="field">
          <label for="cv-headline">Titre</label>
          <input id="cv-headline" v-model="cv.value.value.headline" type="text" />
        </div>
        <div class="field">
          <label for="cv-intro">Introduction</label>
          <textarea id="cv-intro" v-model="cv.value.value.intro" rows="4" />
        </div>

        <MediaPicker v-model="cv.value.value.photoMediaId" libelle="Photo du CV" />
        <MediaPicker v-model="cv.value.value.pdfMediaId" genre="pdf" libelle="CV en PDF" />
        <p class="hint">
          Le PDF est proposé au téléchargement en bas de la page « À propos ». Sans photo, la page
          s'affiche sans encadré : rien ne casse.
        </p>

        <template v-for="r in SECTIONS" :key="r.key">
          <h3>
            {{ r.label }}
            <label class="pill">
              <input v-model="cv.value.value[r.key].visible" type="checkbox" />
              rubrique visible
            </label>
          </h3>
          <ul class="list">
            <li v-for="(e, i) in cv.value.value[r.key].entries" :key="i">
              <div class="entry">
                <div style="flex: 1" class="cluster">
                  <input v-model="e.title" type="text" placeholder="Intitulé" />
                  <input v-model="e.org" type="text" placeholder="Organisation" />
                  <input v-model="e.start" type="text" placeholder="Début" style="max-width: 90px" />
                  <input v-model="e.end" type="text" placeholder="Fin" style="max-width: 90px" />
                </div>
                <div class="cluster">
                  <label class="pill">
                    <input v-model="e.visible" type="checkbox" />
                    visible
                  </label>
                  <button class="btn" type="button" @click="removeEntry(r.key, i)">Retirer</button>
                </div>
              </div>
            </li>
          </ul>
          <button class="btn" type="button" @click="addEntry(r.key)">+ Ajouter</button>
        </template>
      </template>
    </section>
  </div>
</template>
