#!/usr/bin/env node
// Two checks on Vue templates that no other tool in this stack performs.
//
// Biome reads the `<script>` of a .vue WITHOUT the `<template>`, and vue-tsc
// treats neither an unknown auto-imported component nor an undeclared
// attribute as a type error. Both therefore ship silently — and both did, as
// fallout from the French→English rename:
//
//   * app/pages/admin/[slug].vue mounted <DeclinerPanneau> long after the
//     component became VariantsPanel. Vue renders nothing and says nothing:
//     the whole « Décliner » panel was dead on the editing screen.
//   * every MediaPicker call site kept passing `libelle=` and `genre=` while
//     the props had become `label` and `kind`. Vue funnels an undeclared
//     attribute into the fallthrough attributes, so all three pickers were
//     labelled « Image » and the CV PDF could never be selected.
//
// Deliberately narrow. It reads only components declared as a flat file under
// app/components/ and props written `defineProps<{ … }>`, which is every one
// of them today. A form it cannot read produces NO finding rather than a
// false one: a guard that cries wolf is turned off within a day.
//
// Pure, so it can be tested (test/unit/vue-templates.spec.ts); the executable
// part only reads the working tree when called from the command line.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Rendered by Vue or Nuxt itself: they belong to no file. */
const BUILT_IN = new Set([
  'Component',
  'Teleport',
  'Transition',
  'TransitionGroup',
  'KeepAlive',
  'Suspense',
  'NuxtLink',
  'NuxtPage',
  'NuxtLayout',
  'NuxtLoadingIndicator',
  'NuxtErrorBoundary',
  'NuxtImg',
  'NuxtPicture',
  'NuxtWelcome',
  'ClientOnly',
  'DevOnly',
  'ServerPlaceholder',
  'Html',
  'Head',
  'Body',
  'Title',
  'Meta',
  'Link',
  'Style',
  'NoScript',
  'Base',
])

/** Native attributes, never props. */
const NATIVE = new Set(['class', 'style', 'key', 'ref', 'id', 'is', 'slot', 'title', 'role'])

/** `thumbnail-url` and `thumbnailUrl` are the same prop. */
function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/** The `<template>` of a single-file component, or an empty string. */
function template(content) {
  const open = content.indexOf('<template')
  if (open === -1) return ''
  const close = content.lastIndexOf('</template>')
  return close === -1 ? content.slice(open) : content.slice(open, close)
}

/**
 * The props a component declares, or null when the form is unreadable.
 *
 * Only `defineProps<{ … }>` is understood — the single form this codebase
 * uses, wrapped in withDefaults or not. Anything else yields null, which
 * silences the prop check for that component rather than inventing findings.
 */
export function declaredProps(content) {
  const at = content.indexOf('defineProps<')
  if (at === -1) return null

  // Walk the braces: a prop type can itself hold `{ }`, and a regex cannot
  // count.
  const start = content.indexOf('{', at)
  if (start === -1) return null
  let depth = 0
  let end = -1
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return null

  const body = content.slice(start + 1, end)
  const names = new Set()
  let level = 0
  let current = ''
  // Split on the separators that sit at depth zero only: a nested object or
  // a union inside a type must not end a declaration.
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '<') level++
    else if (ch === '}' || ch === ')' || ch === '>') level--

    if (level === 0 && (ch === ';' || ch === '\n' || ch === ',')) {
      const m = current.match(/([A-Za-z_$][\w$]*)\s*\??\s*:/)
      if (m?.[1]) names.add(m[1])
      current = ''
    } else current += ch
  }
  const m = current.match(/([A-Za-z_$][\w$]*)\s*\??\s*:/)
  if (m?.[1]) names.add(m[1])

  // `defineModel()` is the v-model prop, under whatever name it was given.
  if (/defineModel\s*[<(]/.test(content)) names.add('modelValue')

  return names
}

/** Every `<Tag …>` occurrence in a template, with its raw attribute text. */
function usages(tpl) {
  const found = []
  const re = /<([A-Z][A-Za-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g
  let m = re.exec(tpl)
  while (m) {
    found.push({ tag: m[1], attrs: m[2] ?? '' })
    m = re.exec(tpl)
  }
  return found
}

/**
 * The attribute names of a tag, normalised, directives excluded.
 *
 * The value is consumed WITH the name, and that is the whole difficulty: a
 * scanner that only looked for names read « CV en PDF » as three attributes,
 * two of them unknown. A test caught it.
 */
function attributes(raw) {
  const names = []
  const re = /([@:#]?[A-Za-z_][\w.:-]*)\s*(?:=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g
  let m = re.exec(raw)
  while (m) {
    const name = m[1] ?? ''
    // Events, slots and directives are not props. v-model is, and it is
    // handled by its own name below.
    if (name.startsWith('@') || name.startsWith('#')) {
      m = re.exec(raw)
      continue
    }
    if (/^v-/.test(name) && !name.startsWith('v-bind')) {
      if (name === 'v-model' || name.startsWith('v-model:')) names.push('modelValue')
      m = re.exec(raw)
      continue
    }
    const bare = name.replace(/^:/, '').replace(/^v-bind:/, '')
    if (!bare || bare.includes('.')) {
      m = re.exec(raw)
      continue
    }
    if (NATIVE.has(bare) || /^(data|aria)-/.test(bare)) {
      m = re.exec(raw)
      continue
    }
    names.push(camel(bare))
    m = re.exec(raw)
  }
  return names
}

/**
 * The problems of a set of .vue files, as `{ path, rule, message }`.
 * @param {{ path: string, content: string }[]} files
 */
export function checkVueTemplates(files) {
  const components = new Map()
  for (const f of files) {
    const m = f.path.match(/app\/components\/([A-Za-z0-9]+)\.vue$/)
    if (m?.[1]) components.set(m[1], declaredProps(f.content))
  }

  const problems = []
  for (const f of files) {
    const tpl = template(f.content)
    if (!tpl) continue

    for (const { tag, attrs } of usages(tpl)) {
      if (BUILT_IN.has(tag)) continue

      if (!components.has(tag)) {
        problems.push({
          path: f.path,
          rule: 'unknown-component',
          message: `<${tag}> matches no component in app/components/ — Vue renders nothing and says nothing`,
        })
        continue
      }

      const props = components.get(tag)
      if (!props) continue

      for (const name of attributes(attrs)) {
        if (props.has(name)) continue
        problems.push({
          path: f.path,
          rule: 'unknown-prop',
          message: `<${tag}> receives « ${name} », which it does not declare — Vue drops it into the fallthrough attributes`,
        })
      }
    }
  }
  return problems
}

// --- Command line ----------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.vue')) out.push(full)
  }
  return out
}

if (process.argv[1]?.endsWith('vue-templates.mjs')) {
  const files = walk('app').map((path) => ({ path, content: readFileSync(path, 'utf8') }))
  const problems = checkVueTemplates(files)
  for (const { path, rule, message } of problems) console.error(`${path}: ${rule}: ${message}`)
  process.exit(problems.length ? 1 : 0)
}
