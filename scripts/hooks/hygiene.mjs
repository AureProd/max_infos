#!/usr/bin/env node
// File hygiene checks, replacing the Python hooks of `pre-commit-hooks`.
// Eight checks, one per former hook: trailing whitespace, final newline,
// CRLF line endings, conflict markers, large files, case collisions, valid
// YAML and valid JSON.
//
// Unlike the original hooks, this one FIXES NOTHING: it reports. A hook
// that rewrites files under the commit makes the reviewed diff differ from
// the committed one, and Biome already fixes everything formatting-related.
//
// The file exposes pure functions so it can be tested
// (test/unit/hygiene.spec.ts); the executable part only reads the Git index
// when called from the command line.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { parseAllDocuments } from 'yaml'

/** Beyond this, it is an artefact: it has no business in Git history. */
export const MAX_SIZE_KB = 512

/** French typography in articles must not be touched up. */
const NO_WHITESPACE_CHECK = /\.md$/

/** Biome is configured in JSONC: comments and trailing commas belong there. */
const NOT_STRICT_JSON = /^\.vscode\/|\.jsonc$/

const IS_YAML = /\.ya?ml$/
const IS_JSON = /\.json$/

// Anchored at the start of a line and followed by a space: that is the
// exact shape Git writes, and it cannot appear by accident in code.
const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/m

/** A null byte does not occur in text: the file is binary. */
function isBinary(content) {
  return content.includes(0)
}

/**
 * A file's problems, as `{ rule, message }`.
 * @param {{ path: string, content: Buffer }} file
 */
export function checkFile({ path, content }) {
  const problems = []
  const report = (rule, message) => problems.push({ path, rule, message })

  if (content.byteLength > MAX_SIZE_KB * 1024) {
    const kb = Math.round(content.byteLength / 1024)
    report('large-file', `${kb} kB, beyond the ${MAX_SIZE_KB} kB allowed`)
  }

  // A binary has neither lines nor an encoding to check.
  if (isBinary(content)) return problems

  const text = content.toString('utf8')
  if (text.length === 0) return problems

  if (text.includes('\r\n')) {
    report('mixed-line-ending', 'CRLF line endings, LF expected')
  }

  if (!text.endsWith('\n')) {
    report('final-newline', 'no newline at end of file')
  }

  if (!NO_WHITESPACE_CHECK.test(path)) {
    const lines = text.split('\n')
    const offending = lines.map((line, i) => (/[ \t]+\r?$/.test(line) ? i + 1 : 0)).filter(Boolean)
    if (offending.length > 0) {
      report('trailing-whitespace', `line(s) ${offending.join(', ')}`)
    }
  }

  if (CONFLICT_MARKER.test(text)) {
    report('conflict-marker', 'unresolved merge conflict')
  }

  if (IS_YAML.test(path)) {
    // The former hook's `--allow-multiple-documents`: a rendered compose
    // file can hold several.
    const errors = parseAllDocuments(text).flatMap((doc) => doc.errors)
    if (errors.length > 0) report('invalid-yaml', errors[0].message.split('\n')[0])
  }

  if (IS_JSON.test(path) && !NOT_STRICT_JSON.test(path)) {
    try {
      JSON.parse(text)
    } catch (error) {
      report('invalid-json', error.message)
    }
  }

  return problems
}

/**
 * Two paths differing only by case: invisible under Linux, destructive on
 * clone under macOS or Windows.
 * @param {string[]} paths
 */
export function checkCaseCollisions(paths) {
  const seen = new Map()
  const problems = []
  for (const path of paths) {
    const key = path.toLowerCase()
    const already = seen.get(key)
    if (already !== undefined) {
      problems.push({
        path,
        rule: 'case-collision',
        message: `differs from ${already} only by case`,
      })
    } else {
      seen.set(key, path)
    }
  }
  return problems
}

/** The staged files, or the ones passed as arguments. */
function filesToCheck(argv) {
  if (argv.length > 0) return argv
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  })
  return output.split('\n').filter(Boolean)
}

function main() {
  const paths = filesToCheck(process.argv.slice(2))
  const problems = checkCaseCollisions(paths)

  for (const path of paths) {
    // A file staged then deleted from disk cannot be read: that is not a
    // hygiene fault.
    let content
    try {
      if (!statSync(path).isFile()) continue
      content = readFileSync(path)
    } catch {
      continue
    }
    problems.push(...checkFile({ path, content }))
  }

  if (problems.length === 0) return 0

  console.error('/!\\ File hygiene:')
  for (const { path, rule, message } of problems) {
    console.error(`    ${path} — ${rule}: ${message}`)
  }
  return 1
}

if (import.meta.filename === process.argv[1]) process.exit(main())
