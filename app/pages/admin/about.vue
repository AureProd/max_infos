<script setup lang="ts">
import { cleanContactFields, newContactField } from '#shared/utils/contact'
import { CV_LISTS, CV_SECTIONS, type CvSectionKey, cleanCvLists } from '#shared/utils/cv'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const identity = useSetting('identity')
// Le nettoyage porte sur ce qui PART, jamais sur ce qui s'affiche : une
// ligne vide qu'on vient d'ajouter doit rester à l'écran le temps qu'on la
// remplisse. Le schéma, lui, refuse tout le réglage pour une seule ligne
// incomplète — d'où ce filtre à l'envoi.
const contact = useSetting('contact', (v) => ({ fields: cleanContactFields(v.fields) }))
const cv = useSetting('cv', (v) => ({ ...v, ...cleanCvLists(v) }))

await Promise.all([identity.load(), contact.load(), cv.load()])

const { fail } = useNotify()
const confirmDialog = useConfirm()

/**
 * Une suppression se confirme. Toutes, de la même façon.
 *
 * Chaque corbeille de cet écran retirait sa ligne au premier clic, sans un
 * mot : une entrée de CV, un contact, une compétence — tout part, et
 * l'enregistrement automatique l'écrit une seconde plus tard. Il n'y avait
 * rien à annuler.
 */
function askRemove(what: string, done: () => void): void {
  confirmDialog.require({
    header: 'Supprimer',
    message: `${what} sera retiré. L'enregistrement est automatique.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Supprimer',
    acceptProps: { severity: 'danger' },
    rejectLabel: 'Annuler',
    rejectProps: { severity: 'secondary', outlined: true },
    accept: done,
  })
}

/** Ce qu'on nomme dans la question, quand la ligne porte déjà un nom. */
const named = (value: string | null | undefined, fallback: string): string =>
  value?.trim() ? `« ${value.trim()} »` : fallback

const states = computed(() => [identity.state.value, contact.state.value, cv.state.value])
const saving = computed(() => states.value.includes('enregistrement'))
const failed = computed(() => states.value.includes('échec'))
const saved = computed(() => states.value.every((e) => e === 'enregistré'))

/** The reason of whichever of the three refused, so the toast says why. */
const failure = computed(() => identity.error.value || contact.error.value || cv.error.value || '')
watch(failure, (why) => {
  if (why) fail(why, 'Enregistrement refusé')
})

/**
 * L'enregistrement est automatique, comme dans l'éditeur d'article.
 *
 * Il y avait un bouton « Enregistrer » unique pour les trois onglets, donc
 * un onglet qu'on quittait sans le presser perdait tout — sans un mot. Le
 * délai laisse le temps de finir une phrase avant d'écrire.
 */
let timer: ReturnType<typeof setTimeout> | undefined
let ready = false
onMounted(() => {
  // Après le premier rendu seulement : le chargement des trois réglages
  // déclenche le watcher, qui réenregistrerait aussitôt ce qu'il vient de lire.
  nextTick(() => {
    ready = true
  })
})

watch(
  [identity.value, contact.value, cv.value],
  () => {
    if (!ready) return
    clearTimeout(timer)
    timer = setTimeout(saveAll, 1200)
  },
  { deep: true },
)

async function saveAll(): Promise<void> {
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

/**
 * L'ordre des contacts est celui de la page publique.
 *
 * `publicContact` sert le tableau tel quel : ce qui est en tête ici est en
 * tête là-bas. Le seul moyen de réordonner était de retaper les champs les
 * uns par-dessus les autres.
 */
function moveContact(from: number, to: number): void {
  const fields = contact.value.value?.fields
  if (!fields || to < 0 || to >= fields.length) return
  const [moved] = fields.splice(from, 1)
  if (moved) fields.splice(to, 0, moved)
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

    <!-- `is-inline` : l'état d'enregistrement n'est pas une action, il tient
         sur la ligne du titre même sur un téléphone, où les barres d'actions
         passent dessous. -->
    <div class="admin-title is-inline">
      <div>
        <h1>À propos</h1>
      </div>
      <div class="admin-actions">
        <SaveState :saving="saving" :failed="failed" :saved="saved" />
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
        <Tab value="cv">CV</Tab>
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

                  <OrderArrows
                    :index="i"
                    :count="contact.value.value.fields.length"
                    :what="`« ${field.label || 'ce champ'} »`"
                    @move="(to) => moveContact(i, to)"
                  />

                  <!-- L'interrupteur SE VOIT : le mot à côté ne disait rien
                       de plus que sa position, et prenait une colonne. -->
                  <ToggleSwitch
                    v-model="field.visible"
                    v-tooltip.top="field.visible ? 'Visible sur le site' : 'Masqué'"
                    :aria-label="`Montrer « ${field.label || 'ce champ'} » sur le site`"
                  />

                  <Button
                    v-tooltip.top="'Retirer ce champ'"
                    severity="danger"
                    outlined
                    size="small"
                    icon="pi pi-trash"
                    aria-label="Retirer"
                    @click="
                      askRemove(named(field.label, 'Ce champ'), () =>
                        contact.value.value?.fields.splice(i, 1),
                      )
                    "
                  />
                </div>
                <p v-if="isSensitive(field) && field.visible" class="a-err">
                  ⚠ Cette donnée personnelle sera publique et indexée par les moteurs de
                  recherche. Elle restera consultable même après l'avoir retirée.
                </p>
              </li>
            </ul>
            <Button
              severity="secondary"
              outlined
              size="small"
              icon="pi pi-plus"
              label="Ajouter un champ"
              @click="addContact"
            />
          </section>

        </TabPanel>
        <TabPanel value="cv">
          <section v-if="cv.value.value" class="field-group">
            <h2>CV</h2>
              <div class="field">
                <label for="cv-headline">Titre</label>
                <input id="cv-headline" v-model="cv.value.value.headline" type="text" />
              </div>
              <div class="field">
                <label for="cv-intro">Introduction</label>
                <textarea id="cv-intro" v-model="cv.value.value.intro" rows="4" />
              </div>

              <MediaField v-model="cv.value.value.photoMediaId" label="Photo de profil" />
              <MediaField
                v-model="cv.value.value.pdfMediaId"
                kind="pdf"
                label="CV en PDF"
                hint="Le fichier proposé au téléchargement sur la page À propos."
              />
              <p class="hint">
                Le PDF est proposé au téléchargement en bas de la page « À propos ». Sans photo, la page
                s'affiche sans encadré : rien ne casse.
              </p>

            <!--
              Sept rubriques à la suite, chacune avec ses entrées, faisaient
              une page où l'on se perdait : on ne savait plus dans laquelle
              on tapait. Repliées, elles tiennent à l'écran, et l'en-tête dit
              combien d'entrées se cachent dessous.
            -->
            <!--
              UN seul accordéon pour toutes les rubriques du CV.

              Il y en avait deux, l'un pour les rubriques datées et l'autre
              pour les listes, et le trou entre « Engagements » et
              « Compétences » racontait cette séparation technique — qui
              n'existe pas pour celui qui remplit son CV.
            -->
            <Accordion multiple class="a-cv-sections">
              <AccordionPanel v-for="r in CV_SECTIONS" :key="r.key" :value="r.key">
                <AccordionHeader>
                  <span class="a-cv-head">
                    {{ r.label }}
                    <span class="a-cv-count">{{ cv.value.value[r.key].entries.length }}</span>
                    <span v-if="!cv.value.value[r.key].visible" class="a-tag is-draft">masquée</span>
                  </span>
                </AccordionHeader>
                <AccordionContent>
                  <label class="a-switch">
                    <ToggleSwitch v-model="cv.value.value[r.key].visible" />
                    <span>Montrer cette rubrique sur le site</span>
                  </label>

                  <ul class="a-rows">
                    <li v-for="(e, i) in cv.value.value[r.key].entries" :key="i">
                      <div class="a-row-grid is-cv">
                        <input v-model="e.title" class="a-input" type="text" placeholder="Intitulé" />
                        <input v-model="e.org" class="a-input" type="text" placeholder="Organisation" />
                        <input v-model="e.start" class="a-input a-short" type="text" placeholder="Début" />
                        <input v-model="e.end" class="a-input a-short" type="text" placeholder="Fin" />
                        <ToggleSwitch
                          v-model="e.visible"
                          v-tooltip.top="e.visible ? 'Visible sur le site' : 'Masquée'"
                          :aria-label="`Montrer « ${e.title || 'cette entrée'} »`"
                        />
                        <Button
                          v-tooltip.top="'Retirer cette entrée'"
                          severity="danger"
                          outlined
                          size="small"
                          icon="pi pi-trash"
                          aria-label="Retirer"
                          @click="askRemove(named(e.title, 'Cette entrée'), () => removeEntry(r.key, i))"
                        />
                      </div>
                    </li>
                  </ul>
                  <Button
                    severity="secondary"
                    outlined
                    size="small"
                    icon="pi pi-plus"
                    label="Ajouter"
                    @click="addEntry(r.key)"
                  />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="skills">
                <AccordionHeader>
                  <span class="a-cv-head">
                    Compétences
                    <span class="a-cv-count">{{ cv.value.value.skills.length }}</span>
                    <span v-if="!cv.value.value.listsVisible.skills" class="a-tag is-draft">
                      masquée
                    </span>
                  </span>
                </AccordionHeader>
                <AccordionContent>
                  <label class="a-switch">
                    <ToggleSwitch v-model="cv.value.value.listsVisible.skills" />
                    <span>Montrer cette rubrique sur le site</span>
                  </label>
                  <p class="hint">
                    Un groupe porte le nom qui s'affichera sur le site — « Journalisme »,
                    « Domaines », « Diffusion » — puis ses éléments. Un groupe sans nom ou sans
                    élément n'est pas enregistré.
                  </p>
                  <ul class="a-rows is-groups">
                    <li v-for="(set, g) in cv.value.value.skills" :key="g">
                      <div class="a-row-add">
                        <input
                          v-model="set.group"
                          class="a-input"
                          type="text"
                          placeholder="Nom du groupe"
                        />
                        <ToggleSwitch
                          v-model="set.visible"
                          v-tooltip.top="set.visible ? 'Visible sur le site' : 'Masqué'"
                          :aria-label="`Montrer « ${set.group || 'ce groupe'} » sur le site`"
                        />
                        <Button
                          v-tooltip.top="'Retirer ce groupe'"
                          severity="danger"
                          outlined
                          size="small"
                          icon="pi pi-trash"
                          aria-label="Retirer le groupe"
                          @click="
                            askRemove(named(set.group, 'Ce groupe'), () =>
                              cv.value.value?.skills.splice(g, 1),
                            )
                          "
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
                          {{ item }} <i class="pi pi-times" aria-hidden="true" />
                        </button>
                      </div>
                      <div class="a-add">
                        <InputText
                          v-model="typed[g]"
                          placeholder="Ajouter un élément"
                          fluid
                          @keydown.enter.prevent="addItem(g)"
                        />
                        <Button icon="pi pi-plus" aria-label="Ajouter" @click="addItem(g)" />
                      </div>
                    </li>
                  </ul>
                  <Button
                    severity="secondary"
                    outlined
                    size="small"
                    icon="pi pi-plus"
                    label="Ajouter un groupe"
                    @click="cv.value.value?.skills.push({ group: '', items: [], visible: true })"
                  />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel value="languages">
                <AccordionHeader>
                  <span class="a-cv-head">
                    {{ listLabel('languages') }}
                    <span class="a-cv-count">{{ cv.value.value.languages.length }}</span>
                    <span v-if="!cv.value.value.listsVisible.languages" class="a-tag is-draft">
                      masquée
                    </span>
                  </span>
                </AccordionHeader>
                <AccordionContent>
                  <label class="a-switch">
                    <ToggleSwitch v-model="cv.value.value.listsVisible.languages" />
                    <span>Montrer cette rubrique sur le site</span>
                  </label>
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
                          v-tooltip.top="'Retirer cette langue'"
                          severity="danger"
                          outlined
                          size="small"
                          icon="pi pi-trash"
                          aria-label="Retirer"
                          @click="
                            askRemove(named(lang.label, 'Cette langue'), () =>
                              cv.value.value?.languages.splice(i, 1),
                            )
                          "
                        />
                      </div>
                    </li>
                  </ul>
                  <Button
                    severity="secondary"
                    outlined
                    size="small"
                    icon="pi pi-plus"
                    label="Ajouter une langue"
                    @click="cv.value.value?.languages.push({ label: '', level: null })"
                  />
                </AccordionContent>
              </AccordionPanel>

              <AccordionPanel
                v-for="l in (['certifications', 'interests'] as const)"
                :key="l"
                :value="l"
              >
                <AccordionHeader>
                  <span class="a-cv-head">
                    {{ listLabel(l) }}
                    <span class="a-cv-count">{{ cv.value.value[l].length }}</span>
                    <span v-if="!cv.value.value.listsVisible[l]" class="a-tag is-draft">
                      masquée
                    </span>
                  </span>
                </AccordionHeader>
                <AccordionContent>
                  <label class="a-switch">
                    <ToggleSwitch v-model="cv.value.value.listsVisible[l]" />
                    <span>Montrer cette rubrique sur le site</span>
                  </label>
                  <div class="a-chosen">
                    <button
                      v-for="(item, k) in cv.value.value[l]"
                      :key="k"
                      class="a-chip is-on"
                      type="button"
                      :title="`Retirer « ${item} »`"
                      @click="cv.value.value?.[l].splice(k, 1)"
                    >
                      {{ item }} <i class="pi pi-times" aria-hidden="true" />
                    </button>
                  </div>
                  <!--
                    Le bouton fait la même hauteur que le champ : il était
                    monté sur `.a-btn`, dont le rembourrage ne correspondait
                    pas à celui d'un `<input>`, et les deux se décalaient.
                  -->
                  <div class="a-add">
                    <InputText
                      v-model="typed[l]"
                      placeholder="Ajouter"
                      fluid
                      @keydown.enter.prevent="addEntryTo(l)"
                    />
                    <Button icon="pi pi-plus" aria-label="Ajouter" @click="addEntryTo(l)" />
                  </div>
                </AccordionContent>
              </AccordionPanel>
            </Accordion>
          </section>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
