<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const identite = useReglage('identity')
const contact = useReglage('contact')
const cv = useReglage('cv')

await Promise.all([identite.charger(), contact.charger(), cv.charger()])

const etat = computed(() =>
  [identite.etat.value, contact.etat.value, cv.etat.value].includes('échec')
    ? 'échec'
    : [identite.etat.value, contact.etat.value, cv.etat.value].every((e) => e === 'enregistré')
      ? 'enregistré'
      : 'repos',
)

async function enregistrerTout(): Promise<void> {
  await Promise.all([identite.enregistrer(), contact.enregistrer(), cv.enregistrer()])
}

/**
 * Les rubriques du CV, dans l'ordre où elles s'affichent.
 * Chaque rubrique ET chaque entrée porte son propre interrupteur.
 */
const RUBRIQUES = [
  { cle: 'education' as const, libelle: 'Formations' },
  { cle: 'experience' as const, libelle: 'Expériences' },
  { cle: 'engagements' as const, libelle: 'Engagements' },
]

function ajouterEntree(rubrique: 'education' | 'experience' | 'engagements'): void {
  if (!cv.valeur.value) return
  cv.valeur.value[rubrique].entrees.push({ title: '', visible: true })
}

function retirerEntree(rubrique: 'education' | 'experience' | 'engagements', i: number): void {
  cv.valeur.value?.[rubrique].entrees.splice(i, 1)
}

/**
 * Les champs de contact dont la publication mérite réflexion.
 *
 * Le CV comporte des données personnelles qui n'ont rien à faire sur une
 * page publique indexée. L'avertissement s'affiche au moment de rendre
 * l'un d'eux visible, pas après.
 */
const SENSIBLES = /t[ée]l[ée]phone|adresse|naissance|portable|mobile|domicile/i

function estSensible(champ: { key: string; label: string; sensible?: boolean }): boolean {
  return champ.sensible === true || SENSIBLES.test(`${champ.key} ${champ.label}`)
}

function ajouterContact(): void {
  contact.valeur.value?.fields.push({
    key: '',
    label: '',
    value: '',
    // Par défaut MASQUÉ : un champ ajouté ne doit pas devenir public par
    // inadvertance.
    visible: false,
    sensible: false,
  })
}

useSeoMeta({ title: 'À propos', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="etat === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="etat === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="enregistrerTout">Enregistrer</button>
      </AdminNav>

      <h1>À propos</h1>

      <h2>Identité du site</h2>
      <div v-if="identite.valeur.value">
        <div class="field">
          <label for="i-name">Nom du site</label>
          <input id="i-name" v-model="identite.valeur.value.name" type="text" />
        </div>
        <div class="field">
          <label for="i-author">Auteur</label>
          <input id="i-author" v-model="identite.valeur.value.author" type="text" />
        </div>
        <div class="field">
          <label for="i-byline">Signature courte</label>
          <input id="i-byline" v-model="identite.valeur.value.byline" type="text" />
        </div>
        <div class="field">
          <label for="i-tagline">Accroche</label>
          <input id="i-tagline" v-model="identite.valeur.value.tagline" type="text" />
        </div>
        <div class="field">
          <label for="i-pitch">Présentation</label>
          <textarea id="i-pitch" v-model="identite.valeur.value.pitch" rows="3" />
        </div>
      </div>

      <h2>Contact</h2>
      <p class="hint">
        Chaque champ a son propre interrupteur. Un champ ajouté est masqué par défaut.
      </p>
      <ul v-if="contact.valeur.value" class="list">
        <li v-for="(champ, i) in contact.valeur.value.fields" :key="i">
          <div class="entry">
            <div style="flex: 1">
              <div class="cluster">
                <input v-model="champ.label" type="text" placeholder="Libellé" />
                <input v-model="champ.value" type="text" placeholder="Valeur" />
                <input v-model="champ.href" type="text" placeholder="Lien (facultatif)" />
              </div>
              <p v-if="estSensible(champ) && champ.visible" class="err">
                ⚠ Cette donnée personnelle sera publique et indexée par les moteurs de
                recherche. Elle restera consultable même après l'avoir retirée.
              </p>
            </div>
            <div class="cluster">
              <label class="pill">
                <input v-model="champ.visible" type="checkbox" />
                visible
              </label>
              <button
                class="btn"
                type="button"
                @click="contact.valeur.value?.fields.splice(i, 1)"
              >
                Retirer
              </button>
            </div>
          </div>
        </li>
      </ul>
      <button class="btn" type="button" @click="ajouterContact">+ Ajouter un champ</button>

      <template v-if="cv.valeur.value">
        <h2>Curriculum</h2>
        <div class="field">
          <label for="cv-headline">Titre</label>
          <input id="cv-headline" v-model="cv.valeur.value.headline" type="text" />
        </div>
        <div class="field">
          <label for="cv-intro">Introduction</label>
          <textarea id="cv-intro" v-model="cv.valeur.value.intro" rows="4" />
        </div>

        <MediaPicker v-model="cv.valeur.value.photoMediaId" libelle="Photo du CV" />
        <MediaPicker v-model="cv.valeur.value.pdfMediaId" genre="pdf" libelle="CV en PDF" />
        <p class="hint">
          Le PDF est proposé au téléchargement en bas de la page « À propos ». Sans photo, la page
          s'affiche sans encadré : rien ne casse.
        </p>

        <template v-for="r in RUBRIQUES" :key="r.cle">
          <h3>
            {{ r.libelle }}
            <label class="pill">
              <input v-model="cv.valeur.value[r.cle].visible" type="checkbox" />
              rubrique visible
            </label>
          </h3>
          <ul class="list">
            <li v-for="(e, i) in cv.valeur.value[r.cle].entrees" :key="i">
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
                  <button class="btn" type="button" @click="retirerEntree(r.cle, i)">Retirer</button>
                </div>
              </div>
            </li>
          </ul>
          <button class="btn" type="button" @click="ajouterEntree(r.cle)">+ Ajouter</button>
        </template>
      </template>
    </section>
  </div>
</template>
