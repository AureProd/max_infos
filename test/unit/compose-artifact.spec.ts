import { describe, expect, it } from 'vitest'
import { checkComposeArtifact } from '../../scripts/hooks/compose-artifact.mjs'

/** Shorthand: the rules an artefact triggers, without the detail. */
function rules(yaml: string): string[] {
  return checkComposeArtifact(yaml).map((p) => p.rule)
}

/** A rendering that satisfies every rule, to vary one thing at a time. */
const SOUND = `networks:
  default: null
  reverse_proxy:
    external: true
services:
  app:
    env_file:
      - path: \${ENV_FILE:-.env}
        required: false
    labels:
      - traefik.enable=true
  db:
    env_file:
      - path: \${ENV_FILE:-.env}
        required: false
  migrate:
    profiles:
      - migrate
volumes:
  db_data: null
`

describe('a sound artefact', () => {
  it('reports nothing', () => {
    expect(rules(SOUND)).toEqual([])
  })
})

describe('unfolded secrets', () => {
  // THE reason this guard exists. `docker compose config` unfolds env_file
  // into `environment:` IN THE CLEAR, and the repository is public.
  it('refuses a password written out', () => {
    const leaked = SOUND.replace(
      '    labels:',
      '    environment:\n      POSTGRES_PASSWORD: hunter2\n    labels:',
    )
    expect(rules(leaked)).toContain('secret-unfolded')
  })

  it('refuses any NUXT_… secret, key or password', () => {
    for (const key of [
      'NUXT_SESSION_PASSWORD',
      'NUXT_SECRET_ENCRYPTION_KEY',
      'NUXT_R2_SECRET_ACCESS_KEY',
      'NUXT_INSTAGRAM_APP_SECRET',
    ]) {
      const leaked = SOUND.replace('    labels:', `    environment:\n      ${key}: v\n    labels:`)
      expect(rules(leaked), key).toContain('secret-unfolded')
    }
  })

  // The trap CLAUDE.md names: the unfolded form is `NAME: value`, not
  // `NAME=value`. A guard that only looks for `NAME=` watches the wrong door.
  it('is not fooled by the `NAME=value` form it must NOT look for', () => {
    const asLabel = SOUND.replace('      - traefik.enable=true', '      - POSTGRES_PASSWORD=x')
    expect(rules(asLabel)).toContain('secret-unfolded')
  })

  it('tolerates a header deliberately emptied', () => {
    const hidden = SOUND.replace(
      '      - traefik.enable=true',
      '      - traefik.http.middlewares.h.headers.customResponseHeaders.Server=',
    )
    expect(rules(hidden)).not.toContain('secret-unfolded')
  })
})

describe('what the server needs back', () => {
  it('refuses an artefact whose env_file has been swallowed', () => {
    const noEnv = SOUND.replace(/ {4}env_file:\n(?: {6}.*\n)+/g, '')
    expect(rules(noEnv)).toContain('env-file-dropped')
  })

  // Resolved against the CI runner, the path does not exist on the VPS —
  // and `required: false` means the app starts with NO secret at all.
  it('refuses a path resolved on the runner', () => {
    const absolute = SOUND.replace(/\$\{ENV_FILE[^}]*\}/, '/home/runner/work/deploy/.env')
    expect(rules(absolute)).toContain('env-file-absolute')
  })

  it('refuses a missing migrate service', () => {
    expect(rules(SOUND.replace(/ {2}migrate:\n(?: {4}.*\n)+/, ''))).toContain('service-missing')
  })
})

describe('the project name', () => {
  // The name prefixes the db_data volume. If it changes, `up -d` builds a
  // NEW volume and the database becomes an orphan — while the site answers.
  it('refuses a name baked in at render time', () => {
    expect(rules(`name: deploy\n${SOUND}`)).toContain('project-name')
  })

  it('refuses a volume whose name was baked in', () => {
    expect(
      rules(SOUND.replace('  db_data: null', '  db_data:\n    name: deploy_db_data')),
    ).toContain('volume-name')
  })
})
