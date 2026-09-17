<script setup lang="ts">
import { cleanContactFields, newContactField } from '#shared/utils/contact'
import { CV_LISTS, CV_SECTIONS, type CvSectionKey, cleanCvLists } from '#shared/utils/cv'

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

/** The reason of whichever of the three refused, so « échec » says why. */
const failure = computed(() => identity.error.value || contact.error.value || cv.error.value || '')

async function saveAll(): Promise<void> {
  // A blank row and a missing key BOTH had the schema refuse the whole
  // setting — and the identity and the CV alongside it, saved in the same
  // breath. Cleaning before sending is what makes the screen usable.
  if (contact.value.value)
    contact.value.value.fields = cleanContactFields(contact.value.value.fields)
  // Same reason on the CV side: a group left nameless, or a language whose
  // level was never typed (`''` where the schema wants `null`), refused the
  // whole key — and the identity and the contacts with it.
  if (cv.value.value) Object.assign(cv.value.value, cleanCvLists(cv.value.value))
  await Promise.all([identity.save(), contact.save(), cv.save()])
}

/**
 * The dated sections carry a switch, each rubric AND each entry.
 *
 * The list itself lives in `#shared/utils/cv`, next to the chip rubrics,
 * and the public page reads the same one: holding two lists is what let
 * « À propos » render compétences, langues, certifications and centres
 * d'intérêt that this screen never offered to type.
 */
function addEntry(section: CvSectionKey): void {
  if (!cv.value.value) return
  cv.value.value[section].entries.push({ title: '', visible: true })
}

function removeEntry(section: CvSectionKey, i: number): void {
  cv.value.value?.[section].entries.splice(i, 1)
}

/** The label a rubric wears on the site, so both screens say the same. */
const listLabel = (key: 'languages' | 'certifications' | 'interests'): string =>
  CV_LISTS.find((l) => l.key === key)?.label ?? key

/** The item being typed, per group: one input, reused at every row. */
const typed = reactive<Record<string, string>>({})

function addItem(group: number): void {
  const set = cv.value.value?.skills[group]
  const item = (typed[group] ?? '').trim()
  if (!set || item === '' || set.items.includes(item)) return
  set.items.push(item)
  typed[group] = ''
}

function addEntryTo(list: 'certifications' | 'interests'): void {
  const item = (typed[list] ?? '').trim()
  const items = cv.value.value?.[list]
  if (!items || item === '' || items.includes(item)) return
  items.push(item)
  typed[list] = ''
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
  const fields = contact.value.value?.fields
  // The key is an identity, never typed: no input offers it, so leaving it
  // to Max left it empty and the save was refused. HIDDEN by default too —
  // a field added must not become public by accident.
  if (fields) fields.push(newContactField(fields))
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
          <span v-else-if="state === 'échec'" class="a-err">{{ failure }}</span>
          <button class="a-btn a-btn-primary" type="button" @click="saveAll">Enregistrer</button>
      </div>
    </div>

    <!--
      Trois onglets plutôt qu'un empilement de 250 lignes. L'écran demandait
      de faire défiler à l'aveugle pour trouver le curriculum, et il le
      demandait autant sur un téléphone que sur un grand écran : le découpage
      vaut aux deux largeurs, ce qui évite d'en faire dépendre le rendu de la
      taille de la fenêtre — une media query en JavaScript casserait
      l'hydratation.
    -->
    <Tabs value="identite">
      <TabList>
        <Tab value="identite">Identité</Tab>
        <Tab value="contact">Contact</Tab>
        <Tab value="cv">Curriculum</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="identite">
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

        </TabPanel>
        <TabPanel value="contact">
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

        </TabPanel>
        <TabPanel value="cv">
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

            <template v-for="r in CV_SECTIONS" :key="r.key">
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

            <div class="a-section-head">
              <h3>Compétences</h3>
            </div>
            <p class="hint">
              Un groupe porte le nom qui s'affichera sur le site — « Journalisme »,
              « Domaines », « Diffusion » — puis ses éléments. Un groupe sans nom ou sans
              élément n'est pas enregistré.
            </p>
            <ul class="a-rows">
              <li v-for="(set, g) in cv.value.value.skills" :key="g">
                <div class="a-row-add">
                  <input v-model="set.group" class="a-input" type="text" placeholder="Nom du groupe" />
                  <Button
                    severity="danger"
                    outlined
                    size="small"
                    label="Retirer le groupe"
                    @click="cv.value.value?.skills.splice(g, 1)"
                  />
                </div>
                <div class="a-chosen">
                  <button
                    v-for="(item, k) in set.items"
                    :key="k"
                    class="a-chip is-on"
                    type="button"
                    :title="`Retirer « ${item} »`"
                    @click="set.items.splice(k, 1)"
                  >
                    {{ item }} ×
                  </button>
                </div>
                <div class="a-row-add">
                  <input
                    v-model="typed[g]"
                    class="a-input"
                    type="text"
                    placeholder="Ajouter un élément"
                    @keydown.enter.prevent="addItem(g)"
                  />
                  <button class="a-btn" type="button" @click="addItem(g)">+ Ajouter</button>
                </div>
              </li>
            </ul>
            <button
              class="a-btn"
              type="button"
              @click="cv.value.value?.skills.push({ group: '', items: [] })"
            >
              + Ajouter un groupe
            </button>

            <div class="a-section-head">
              <h3>{{ listLabel('languages') }}</h3>
            </div>
            <ul class="a-rows">
              <li v-for="(lang, i) in cv.value.value.languages" :key="i">
                <div class="a-row-add">
                  <input v-model="lang.label" class="a-input" type="text" placeholder="Langue" />
                  <!-- Le niveau reste facultatif : laissé vide, il repart en `null`,
                       jamais en chaîne vide, que le schéma refuserait. -->
                  <input
                    v-model="lang.level"
                    class="a-input a-short"
                    type="text"
                    placeholder="Niveau (facultatif)"
                  />
                  <Button
                    severity="danger"
                    outlined
                    size="small"
                    label="Retirer"
                    @click="cv.value.value?.languages.splice(i, 1)"
                  />
                </div>
              </li>
            </ul>
            <button
              class="a-btn"
              type="button"
              @click="cv.value.value?.languages.push({ label: '', level: null })"
            >
              + Ajouter une langue
            </button>

            <template v-for="l in (['certifications', 'interests'] as const)" :key="l">
              <div class="a-section-head">
                <h3>{{ listLabel(l) }}</h3>
              </div>
              <div class="a-chosen">
                <button
                  v-for="(item, k) in cv.value.value[l]"
                  :key="k"
                  class="a-chip is-on"
                  type="button"
                  :title="`Retirer « ${item} »`"
                  @click="cv.value.value?.[l].splice(k, 1)"
                >
                  {{ item }} ×
                </button>
              </div>
              <div class="a-row-add">
                <input
                  v-model="typed[l]"
                  class="a-input"
                  type="text"
                  placeholder="Ajouter"
                  @keydown.enter.prevent="addEntryTo(l)"
                />
                <button class="a-btn" type="button" @click="addEntryTo(l)">+ Ajouter</button>
              </div>
            </template>
          </section>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
