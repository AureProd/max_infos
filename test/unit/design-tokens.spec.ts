import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rules } from './helpers/css'

/**
 * One palette, read from one place.
 *
 * The site used to carry TWO: a dark `:root` in `base.css` for the public
 * pages, and a light `.admin-ui` in `admin.css` for the back-office, each
 * with its own literal hex codes. Any colour written in a third place
 * silently belonged to neither, and `admin-styles.spec.ts` exists because
 * that is exactly what happened.
 *
 * The tokens now live in the `@theme` block of `main.css` — the shape
 * Tailwind v4 reads — and the two sheets alias them. Nothing else reads a
 * stylesheet, so this test does.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const MAIN = read('app/assets/css/main.css')
const BASE = read('app/assets/css/base.css')
const ADMIN = read('app/assets/css/admin.css')
const CONFIG = read('nuxt.config.ts')

/** The `@theme` block, braces balanced. */
function theme(css: string): string {
  const start = css.indexOf('@theme')
  if (start === -1) return ''
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}

const THEME = theme(MAIN)

/**
 * The values measured on Max's Substack, in the HTML it actually serves —
 * not the Substack defaults. Its accent is NOT the platform orange.
 */
const SUBSTACK = {
  '--color-accent': '#2563eb',
  '--color-accent-strong': '#1555e2',
  '--color-ink': '#363737',
  '--color-muted': '#777878',
  '--color-line': '#c3c3c3',
}

describe('the design tokens', () => {
  it('declares a @theme block at all', () => {
    // Without this, every assertion below would pass on an empty string —
    // the most comfortable kind of green.
    expect(THEME.length).toBeGreaterThan(200)
  })

  for (const [token, value] of Object.entries(SUBSTACK)) {
    it(`carries ${token} from the Substack, at ${value}`, () => {
      expect(THEME).toMatch(new RegExp(`${token}:\\s*${value}\\b`, 'i'))
    })
  }

  it('reads as a light theme, the dark one being gone', () => {
    expect(BASE).toMatch(/color-scheme:\s*light/)
    expect(BASE).not.toMatch(/color-scheme:\s*dark/)
  })

  it('names the two fonts of the Substack, and only those', () => {
    expect(THEME).toMatch(/--font-display:[^;]*BBH Hegarty/)
    expect(THEME).toMatch(/--font-body:[^;]*Lexend/)
    expect(CONFIG).toMatch(/family=BBH\+Hegarty/)
    expect(CONFIG).toMatch(/family=Lexend/)
    // The dark-era pair must not linger in the <head>: an unused font file
    // is a request paid on every first visit.
    expect(CONFIG).not.toMatch(/Bricolage\+Grotesque|Newsreader/)
  })
})

describe('the two sheets', () => {
  /** The `:root` / `.admin-ui` declarations that define a custom property. */
  const definitionsOf = (css: string, selector: string) =>
    rules(css)
      .filter((r) => r.selector.split(',').some((s) => s.trim() === selector))
      .flatMap((r) => r.body.split(';'))
      .filter((line) => /^\s*--/.test(line))

  it('defines the public palette by reference, never by literal colour', () => {
    const literal = definitionsOf(BASE, ':root').filter((line) => /#[0-9a-f]{3,8}\b/i.test(line))
    expect(literal).toEqual([])
  })

  it('defines the back-office palette by reference too', () => {
    const literal = definitionsOf(ADMIN, '.admin-ui').filter((line) =>
      /#[0-9a-f]{3,8}\b/i.test(line),
    )
    expect(literal).toEqual([])
  })
})

describe('the cascade', () => {
  /**
   * Tailwind's utilities must win over the PrimeVue theme — otherwise a
   * utility class on a PrimeVue control does nothing, silently — and the
   * hand-written sheets must win over PrimeVue while they are emptied.
   *
   * PrimeVue is the one that WRITES the `@layer …;` statement, from this
   * `order`. A statement written in `main.css` instead would be compiled
   * away by Tailwind, and the layers would fall back to order of appearance
   * with PrimeVue — injected at runtime — last.
   */
  const ORDER = 'theme, base, primevue, site, components, utilities'

  it('gives PrimeVue the full order, its own layer included', () => {
    expect(CONFIG).toContain(`order: '${ORDER}'`)
  })

  it('puts the two hand-written sheets in the `site` layer', () => {
    // Unlayered, they would beat the Tailwind utilities too, and no screen
    // could be migrated one class at a time.
    expect(MAIN).toMatch(/@import '\.\/base\.css' layer\(site\)/)
    expect(read('app/layouts/admin.vue')).toMatch(
      /@import '~\/assets\/css\/admin\.css' layer\(site\)/,
    )
  })

  it('lets Tailwind emit its own layers rather than hand-rolling them', () => {
    expect(MAIN).toMatch(/@import 'tailwindcss';/)
  })
})

describe('the PrimeVue auto-import list', () => {
  /**
   * A PrimeVue component missing from `primevue.components.include` renders
   * NOTHING — no warning, no error, an empty screen. And
   * `scripts/hooks/vue-templates.mjs` does not catch it: it reads
   * `node_modules/primevue`, where the component does exist, not this list.
   *
   * So this test reads the templates and the list, and compares them.
   */
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(join(process.cwd(), dir))) {
      const path = `${dir}/${name}`
      if (statSync(join(process.cwd(), path)).isDirectory()) walk(path)
      else if (name.endsWith('.vue')) files.push(path)
    }
  }
  walk('app')

  /**
   * The names quoted inside `components.include`.
   *
   * Splitting the block on commas would not do: the comments that explain
   * the list contain commas of their own, and the entry right after one
   * comes back glued to it. The comments go first, then only the quoted
   * strings are read.
   */
  const listOf = (key: string) => {
    const block =
      new RegExp(`${key}:\\s*\\{\\s*include:\\s*\\[([^\\]]*)\\]`).exec(CONFIG)?.[1] ?? ''
    const code = block.replace(/\/\/[^\n]*/g, '')
    return new Set([...code.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1] as string))
  }

  const included = listOf('components')
  const directives = listOf('directives')

  /** Every PrimeVue component this repository could ask for. */
  const known = new Set(
    readdirSync(join(process.cwd(), 'node_modules/primevue')).filter((name) =>
      /^[a-z]+$/.test(name),
    ),
  )

  it('knows what PrimeVue ships, and what the config includes', () => {
    expect(known.size).toBeGreaterThan(50)
    expect(included.size).toBeGreaterThan(5)
  })

  it('registers Tooltip as a directive, never as a component', () => {
    // `v-tooltip` listed among the components is never registered, and the
    // directive simply does nothing — no warning, no error.
    expect(directives.has('Tooltip')).toBe(true)
    expect(included.has('Tooltip')).toBe(false)
  })

  it('includes every PrimeVue component the templates use', () => {
    const missing = new Set<string>()
    for (const file of files) {
      const template = read(file)
      for (const match of template.matchAll(/<([A-Z][A-Za-z]*)[\s/>]/g)) {
        const name = match[1] ?? ''
        if (known.has(name.toLowerCase()) && !included.has(name)) missing.add(name)
      }
    }
    expect([...missing].sort()).toEqual([])
  })
})
