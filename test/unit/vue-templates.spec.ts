import { describe, expect, it } from 'vitest'
import { checkVueTemplates } from '../../scripts/hooks/vue-templates.mjs'

/** Shorthand: the rules a set of files triggers, without the detail. */
function rules(files: { path: string; content: string }[]): string[] {
  return checkVueTemplates(files).map((p) => p.rule)
}

/** A component that declares exactly the props the callers should pass. */
const PICKER = {
  path: 'app/components/MediaPicker.vue',
  content: `<script setup lang="ts">
const model = defineModel<number | null>({ default: null })
const props = withDefaults(defineProps<{ kind?: 'image' | 'pdf'; label?: string }>(), {
  kind: 'image',
  label: 'Image',
})
</script>
<template><div>{{ props.label }}{{ model }}</div></template>
`,
}

describe('a sound set of files', () => {
  it('reports nothing', () => {
    const page = {
      path: 'app/pages/admin/about.vue',
      content: `<template>
  <div class="wrap">
    <MediaPicker v-model="id" kind="pdf" label="CV en PDF" />
    <NuxtLink to="/">Accueil</NuxtLink>
  </div>
</template>`,
    }
    expect(rules([PICKER, page])).toEqual([])
  })
})

describe('a component that does not exist', () => {
  // The real one, shipped: app/pages/admin/[slug].vue mounted
  // <DeclinerPanneau> while the component had been renamed VariantsPanel.
  // vue-tsc says nothing — an unknown auto-imported component is not a type
  // error — so the whole « Décliner » panel was dead on the editing screen.
  it('is reported', () => {
    const page = {
      path: 'app/pages/admin/[slug].vue',
      content: '<template><DeclinerPanneau :slug="s" /></template>',
    }
    expect(rules([PICKER, page])).toContain('unknown-component')
  })

  it('does not confuse a Nuxt built-in for one', () => {
    const page = {
      path: 'app/app.vue',
      content: '<template><NuxtLayout><NuxtPage /></NuxtLayout></template>',
    }
    expect(rules([PICKER, page])).toEqual([])
  })

  it('leaves ordinary HTML alone', () => {
    const page = {
      path: 'app/pages/x.vue',
      content: '<template><section><h1>Titre</h1><img src="a.png" /></section></template>',
    }
    expect(rules([PICKER, page])).toEqual([])
  })
})

describe('a prop the component does not declare', () => {
  // The other real one: every call site passed the French names the rename
  // had left behind. Vue drops an undeclared attribute into the fallthrough
  // attributes without a word, so all three pickers were labelled « Image »
  // and the CV PDF could never be selected — kind stayed 'image'.
  it('is reported, bound or not', () => {
    const page = {
      path: 'app/pages/admin/about.vue',
      content: '<template><MediaPicker libelle="Photo du CV" genre="pdf" /></template>',
    }
    expect(rules([PICKER, page]).filter((r) => r === 'unknown-prop')).toHaveLength(2)
  })

  it('accepts a prop written in kebab-case', () => {
    const card = {
      path: 'app/components/PublicationCard.vue',
      content: `<script setup lang="ts">
defineProps<{ thumbnailUrl: string | null }>()
</script>
<template><img /></template>`,
    }
    const page = {
      path: 'app/pages/x.vue',
      content: '<template><PublicationCard :thumbnail-url="u" /></template>',
    }
    expect(rules([card, page])).toEqual([])
  })

  // Directives, events, slots and native attributes are not props, and a
  // guard that flagged them would be turned off within a day.
  it('leaves directives, events and native attributes alone', () => {
    const page = {
      path: 'app/pages/x.vue',
      content: `<template>
  <MediaPicker
    v-if="ok"
    v-model="id"
    class="field"
    style="margin:0"
    :key="i"
    ref="picker"
    data-test="picker"
    aria-label="Média"
    @change="onChange"
  />
</template>`,
    }
    expect(rules([PICKER, page])).toEqual([])
  })

  // No declaration at all means no expectation: reporting every attribute
  // of a component whose props we failed to read would be noise, not signal.
  it('says nothing about a component whose props it cannot read', () => {
    const opaque = {
      path: 'app/components/Opaque.vue',
      content: '<script setup lang="ts">\nconst x = 1\n</script>\n<template><b /></template>',
    }
    const page = { path: 'app/pages/x.vue', content: '<template><Opaque foo="1" /></template>' }
    expect(rules([opaque, page])).toEqual([])
  })
})

describe('composants PrimeVue', () => {
  it('accepts an auto-imported component when PrimeVue provides it', () => {
    // Without this the guard flags every <DataTable> and blocks the commit.
    const files = [
      { path: 'app/pages/admin/tech.vue', content: '<template><DataTable /></template>' },
    ]
    expect(checkVueTemplates(files, new Set(['datatable']))).toEqual([])
  })

  it('still flags a component PrimeVue does not provide', () => {
    const files = [
      { path: 'app/pages/admin/tech.vue', content: '<template><DataTabel /></template>' },
    ]
    const problems = checkVueTemplates(files, new Set(['datatable']))
    expect(problems).toHaveLength(1)
    expect(problems[0]?.rule).toBe('unknown-component')
  })
})

/**
 * Un composant qu'un fichier IMPORTE lui-même.
 *
 * `<EditorContent>` vient de Tiptap : il n'est ni dans app/components/, ni
 * auto-importé par PrimeVue, et il était pourtant signalé comme inconnu —
 * sans aucun moyen de faire taire le contrôle sur un composant parfaitement
 * déclaré.
 */
describe('un composant amené par un import', () => {
  const file = (content: string) => [{ path: 'app/components/Ecran.vue', content }]

  it('ne le signale pas comme inconnu', () => {
    const source = `<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
</script>
<template><EditorContent :editor="editor" /></template>`
    expect(checkVueTemplates(file(source))).toEqual([])
  })

  it('accepte aussi un import par défaut', () => {
    const source = `<script setup lang="ts">
import Chose from 'ailleurs'
</script>
<template><Chose /></template>`
    expect(checkVueTemplates(file(source))).toEqual([])
  })

  it('signale toujours ce qui n’est importé nulle part', () => {
    const source = `<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
</script>
<template><EditorContent /><Fantome /></template>`
    const problems = checkVueTemplates(file(source))
    expect(problems).toHaveLength(1)
    expect(problems[0]?.message).toContain('<Fantome>')
  })

  it('ne prend pas un type importé pour un composant utilisé', () => {
    // `import type { Role }` déclare un type, pas une balise : si <Role>
    // apparaît dans le template, c'est une erreur qui doit se voir.
    const source = `<script setup lang="ts">
const x = 1
</script>
<template><Role /></template>`
    expect(checkVueTemplates(file(source))).toHaveLength(1)
  })
})
