<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

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
  <div>

    <div class="admin-title">
      <div>
        <h1>À propos</h1>
      </div>
      <div class="admin-actions">
          <span v-if="state === 'enregistré'" class="a-tag is-ok">enregistré</span>
          <span v-else-if="state === 'échec'" class="a-err">échec</span>
          <button class="a-btn a-btn-primary" type="button" @click="saveAll">Enregistrer</button>
      </div>
    </div>

    <section class="field-group">
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
    </section>

    <section class="field-group">
      <h2>Contact</h2>
      <p class="hint">
        Chaque champ a son propre interrupteur. Un champ ajouté est masqué par défaut.
      </p>
      <!--
        Une grille plutôt qu'une rangée en flex : les trois champs
        s'alignent d'une ligne à l'autre, au lieu de se serrer les uns
        contre les autres selon la longueur de ce qu'on y tape.
      -->
      <ul v-if="contact.value.value" class="a-rows">
        <li v-for="(field, i) in contact.value.value.fields" :key="i">
          <div class="a-row-grid">
            <input v-model="field.label" class="a-input" type="text" placeholder="Libellé" />
            <input v-model="field.value" class="a-input" type="text" placeholder="Valeur" />
            <input
              v-model="field.href"
              class="a-input"
              type="text"
              placeholder="Lien (facultatif)"
            />

            <!-- Un interrupteur se voit ; une case dans une pastille bleue,
                 non. -->
            <label class="a-switch">
              <ToggleSwitch v-model="field.visible" />
              <span>{{ field.visible ? 'visible' : 'masqué' }}</span>
            </label>

            <Button
              severity="danger"
              outlined
              size="small"
              label="Retirer"
              @click="contact.value.value?.fields.splice(i, 1)"
            />
          </div>
          <p v-if="isSensitive(field) && field.visible" class="a-err">
            ⚠ Cette donnée personnelle sera publique et indexée par les moteurs de
            recherche. Elle restera consultable même après l'avoir retirée.
          </p>
        </li>
      </ul>
      <button class="a-btn" type="button" @click="addContact">+ Ajouter un champ</button>
    </section>

    <section v-if="cv.value.value" class="field-group">
      <h2>Curriculum</h2>
        <div class="field">
          <label for="cv-headline">Titre</label>
          <input id="cv-headline" v-model="cv.value.value.headline" type="text" />
        </div>
        <div class="field">
          <label for="cv-intro">Introduction</label>
          <textarea id="cv-intro" v-model="cv.value.value.intro" rows="4" />
        </div>

        <MediaPicker v-model="cv.value.value.photoMediaId" label="Photo du CV" />
        <MediaPicker v-model="cv.value.value.pdfMediaId" kind="pdf" label="CV en PDF" />
        <p class="hint">
          Le PDF est proposé au téléchargement en bas de la page « À propos ». Sans photo, la page
          s'affiche sans encadré : rien ne casse.
        </p>

      <template v-for="r in SECTIONS" :key="r.key">
          <div class="a-section-head">
            <h3>{{ r.label }}</h3>
            <label class="a-switch">
              <ToggleSwitch v-model="cv.value.value[r.key].visible" />
              <span>{{ cv.value.value[r.key].visible ? 'rubrique visible' : 'rubrique masquée' }}</span>
            </label>
          </div>
          <ul class="a-rows">
            <li v-for="(e, i) in cv.value.value[r.key].entries" :key="i">
              <div class="a-row-grid is-cv">
                <input v-model="e.title" class="a-input" type="text" placeholder="Intitulé" />
                <input v-model="e.org" class="a-input" type="text" placeholder="Organisation" />
                <input v-model="e.start" class="a-input a-short" type="text" placeholder="Début" />
                <input v-model="e.end" class="a-input a-short" type="text" placeholder="Fin" />
                <label class="a-switch">
                  <ToggleSwitch v-model="e.visible" />
                </label>
                <Button
                  severity="danger"
                  outlined
                  size="small"
                  label="Retirer"
                  @click="removeEntry(r.key, i)"
                />
              </div>
            </li>
          </ul>
          <button class="a-btn" type="button" @click="addEntry(r.key)">+ Ajouter</button>
        </template>
    </section>
  </div>
</template>
