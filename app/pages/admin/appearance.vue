<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { value: theme, state, load, save } = useSetting('theme')
await load()

/**
 * Les variables CSS qu'on expose au réglage.
 *
 * Volontairement peu nombreuses : base.css en définit bien davantage, mais
 * les exposer toutes reviendrait à demander à Max de comprendre une feuille
 * de style. Celles-ci suffisent à changer l'allure du site.
 */
const SETTABLE = [
  { key: 'ink', label: 'Fond', defaut: '#11161C' },
  { key: 'surface', label: 'Surfaces', defaut: '#1B222A' },
  { key: 'text', label: 'Texte', defaut: '#DBDEE1' },
  { key: 'muted', label: 'Texte discret', defaut: '#949BA4' },
  { key: 'accent', label: 'Accent', defaut: '#D9A353' },
] as const

const variables = computed(() => theme.value?.variables ?? {})

function set(key: string, value: string): void {
  if (!theme.value) return
  theme.value.variables = { ...theme.value.variables, [key]: value }
}

function reset(key: string): void {
  if (!theme.value) return
  const copied = { ...theme.value.variables }
  delete copied[key]
  theme.value.variables = copied
}

/**
 * Aperçu en direct : les variables sont posées sur un conteneur, pas sur
 * :root. Modifier la vraie root changerait aussi l'apparence du
 * back-office pendant qu'on règle, ce qui rend le réglage illisible.
 */
const previewStyle = computed(() =>
  Object.fromEntries(Object.entries(variables.value).map(([c, v]) => [`--${c}`, v])),
)

useSeoMeta({ title: 'Apparence', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="wrap">
    <section class="admin-page">
      <AdminNav>
        <span v-if="state === 'enregistré'" class="note">enregistré</span>
        <span v-else-if="state === 'échec'" class="err">échec</span>
        <button class="btn btn-primary" type="button" @click="save">Enregistrer</button>
      </AdminNav>

      <h1>Apparence</h1>
      <p class="hint">
        Les couleurs du site. Laisser un réglage vide revient à garder celui d'origine.
      </p>

      <div class="editor">
        <div>
          <div v-for="r in SETTABLE" :key="r.key" class="field">
            <label :for="`c-${r.key}`">{{ r.label }}</label>
            <div class="cluster">
              <input
                :id="`c-${r.key}`"
                type="color"
                :value="variables[r.key] ?? r.defaut"
                @input="set(r.key, ($event.target as HTMLInputElement).value)"
              />
              <input
                type="text"
                :value="variables[r.key] ?? ''"
                :placeholder="r.defaut"
                @change="set(r.key, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="variables[r.key]"
                class="btn"
                type="button"
                @click="reset(r.key)"
              >
                Rétablir
              </button>
            </div>
          </div>
        </div>

        <div class="preview" :style="previewStyle">
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
