<script setup lang="ts">
definePageMeta({ middleware: 'redaction' })

const { valeur: theme, etat, charger, enregistrer } = useReglage('theme')
await charger()

/**
 * Les variables CSS qu'on expose au réglage.
 *
 * Volontairement peu nombreuses : base.css en définit bien davantage, mais
 * les exposer toutes reviendrait à demander à Max de comprendre une feuille
 * de style. Celles-ci suffisent à changer l'allure du site.
 */
const REGLABLES = [
  { cle: 'ink', libelle: 'Fond', defaut: '#11161C' },
  { cle: 'surface', libelle: 'Surfaces', defaut: '#1B222A' },
  { cle: 'text', libelle: 'Texte', defaut: '#DBDEE1' },
  { cle: 'muted', libelle: 'Texte discret', defaut: '#949BA4' },
  { cle: 'accent', libelle: 'Accent', defaut: '#D9A353' },
] as const

const variables = computed(() => theme.value?.variables ?? {})

function poser(cle: string, valeur: string): void {
  if (!theme.value) return
  theme.value.variables = { ...theme.value.variables, [cle]: valeur }
}

function reinitialiser(cle: string): void {
  if (!theme.value) return
  const copie = { ...theme.value.variables }
  delete copie[cle]
  theme.value.variables = copie
}

/**
 * Aperçu en direct : les variables sont posées sur un conteneur, pas sur
 * :root. Modifier la vraie racine changerait aussi l'apparence du
 * back-office pendant qu'on règle, ce qui rend le réglage illisible.
 */
const styleApercu = computed(() =>
  Object.fromEntries(Object.entries(variables.value).map(([c, v]) => [`--${c}`, v])),
)

useSeoMeta({ title: 'Apparence', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="etat === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="etat === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="enregistrer">Enregistrer</button>
      </AdminNav>

      <h1>Apparence</h1>
      <p class="hint">
        Les couleurs du site. Laisser un réglage vide revient à garder celui d'origine.
      </p>

      <div class="editor">
        <div>
          <div v-for="r in REGLABLES" :key="r.cle" class="field">
            <label :for="`c-${r.cle}`">{{ r.libelle }}</label>
            <div class="cluster">
              <input
                :id="`c-${r.cle}`"
                type="color"
                :value="variables[r.cle] ?? r.defaut"
                @input="poser(r.cle, ($event.target as HTMLInputElement).value)"
              />
              <input
                type="text"
                :value="variables[r.cle] ?? ''"
                :placeholder="r.defaut"
                @change="poser(r.cle, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="variables[r.cle]"
                class="btn"
                type="button"
                @click="reinitialiser(r.cle)"
              >
                Rétablir
              </button>
            </div>
          </div>
        </div>

        <div class="preview" :style="styleApercu">
          <!-- Aperçu sur un conteneur, jamais sur :root : sinon le
               back-office changerait d'apparence pendant le réglage. -->
          <div
            style="
              background: var(--ink, #11161c);
              color: var(--text, #dbdee1);
              padding: 24px;
              border-radius: 4px;
            "
          >
            <h3 style="margin-top: 0">Un titre d'article</h3>
            <p style="color: var(--muted, #949ba4)">
              Le chapô, en texte discret, tel qu'il apparaîtra sur le site.
            </p>
            <p>Le corps du texte, dans sa couleur principale.</p>
            <p>
              <a href="#" style="color: var(--accent, #d9a353)" @click.prevent>Un lien accentué</a>
            </p>
            <div
              style="
                background: var(--surface, #1b222a);
                padding: 12px;
                border-radius: 3px;
                margin-top: 12px;
              "
            >
              Une surface, pour les cartes et les encadrés.
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
