#!/usr/bin/env node
// Guards the single Compose artefact the CI renders for production.
//
// `docker compose config` is the only sane way to ship ONE file instead of a
// base plus an override — but four of its behaviours turn a correct rendering
// into a broken or dangerous one, and none of them says a word:
//
//   1. it UNFOLDS env_file into `environment:`, in the clear. The repository
//      is public, and a rendered artefact travels through CI logs.
//   2. it DROPS env_file when the file is absent at render time — the app
//      then starts on the server with no secret at all.
//   3. it RESOLVES relative paths against the render directory, i.e. the CI
//      runner, so the path does not exist on the VPS.
//   4. it BAKES the render-time project name into `name:` and into every
//      volume. A changed name means a NEW db_data volume: the site answers,
//      and the database is an orphan.
//
// The flags that avoid all four are
//   --no-interpolate --no-path-resolution --no-normalize
// plus stripping the leading `name:`. This file is what proves they were
// used, on the artefact itself rather than on the command that made it.
//
// Pure, so it can be tested (test/unit/compose-artifact.spec.ts); the
// executable part only reads a path when called from the command line.
import { readFileSync } from 'node:fs'

/**
 * Names whose value must never appear written out.
 *
 * Matched on the KEY, not on the value: a password cannot be recognised by
 * looking at it, and a list of literal secrets would itself be a secret.
 *
 * Deliberately broad — a word anywhere in the name is enough. Refusing a
 * harmless variable costs one rename; letting a real one through costs a
 * rotated credential on a public repository.
 */
const SECRET_KEY = /(PASSWORD|SECRET|TOKEN|CREDENTIAL|PRIVATE|KEY)/

/** Services the production artefact cannot do without. */
const REQUIRED_SERVICES = ['app', 'db', 'migrate']

/**
 * The artefact's problems, as `{ rule, message }`.
 * @param {string} yaml The rendered docker-compose.yml, as text.
 */
export function checkComposeArtifact(yaml) {
  const problems = []
  const report = (rule, message) => problems.push({ rule, message })
  const lines = yaml.split('\n')

  // --- 1. Unfolded secrets -------------------------------------------------
  //
  // Both shapes, deliberately. CLAUDE.md warns that the unfolded form is
  // `NAME: value` and that a guard looking only for `NAME=` watches the wrong
  // door — but a label carrying a secret is a leak too, so we watch both.
  for (const [i, line] of lines.entries()) {
    const m = line.match(/^\s*-?\s*([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/)
    if (!m) continue
    const [, key, value] = m
    // An empty value is not a secret: it is how customResponseHeaders
    // removes a header.
    if (value.trim() === '' || value.trim() === '""') continue
    if (SECRET_KEY.test(key)) {
      report('secret-unfolded', `line ${i + 1}: ${key} is written out in the artefact`)
    }
  }

  // --- 2 & 3. What the server needs back -----------------------------------
  if (!/^\s*env_file:/m.test(yaml)) {
    report(
      'env-file-dropped',
      'no env_file: the container would start without a single secret. Render with --no-interpolate.',
    )
  }
  for (const [i, line] of lines.entries()) {
    if (/^\s*-?\s*path:\s*\//.test(line)) {
      report(
        'env-file-absolute',
        `line ${i + 1}: an absolute path, resolved on the runner. Render with --no-path-resolution.`,
      )
    }
  }
  for (const service of REQUIRED_SERVICES) {
    if (!new RegExp(`^\\s{2}${service}:`, 'm').test(yaml)) {
      report(
        'service-missing',
        `the ${service} service is absent. A service behind a profile needs --profile.`,
      )
    }
  }

  // --- 4. The project name -------------------------------------------------
  if (/^name:/m.test(yaml)) {
    report(
      'project-name',
      'a project name baked in at render time would move db_data to a new volume',
    )
  }
  const volumes = yaml.match(/^volumes:\n(?:[ \t].*\n?)*/m)?.[0] ?? ''
  if (/^\s+name:/m.test(volumes)) {
    report('volume-name', 'a volume name baked in at render time orphans the database')
  }

  return problems
}

// --- Command line ----------------------------------------------------------
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: compose-artifact.mjs <rendered docker-compose.yml>')
    process.exit(2)
  }
  const problems = checkComposeArtifact(readFileSync(path, 'utf8'))
  for (const { rule, message } of problems) console.error(`${path}: ${rule}: ${message}`)
  process.exit(problems.length ? 1 : 0)
}
