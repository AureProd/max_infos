import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The production Traefik labels, read from the files that are actually
 * shipped — the common base AND the production override, because that is the
 * combination the VPS runs. Reading the base alone would miss the entrypoint
 * and the certificate resolver, and would call a broken site correct.
 *
 * These rules are not style: each one stands for an outage this project has
 * already paid for. Traefik discards a misconfigured router WITHOUT an error
 * message, so nothing but a test can hold them.
 *
 * Everything is matched by pattern rather than by the literal
 * `app-<instance>` name: the suffix is a variable, and a test that spelled it
 * out would break on a rename that broke nothing.
 */
const compose = [
  readFileSync('deploy/docker-compose.yml', 'utf8'),
  readFileSync('deploy/docker-compose-prod-override.yml', 'utf8'),
].join('\n')

/** The `- traefik.…` lines of the `app` service, without their leading dash. */
const labels = compose
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('- traefik.'))
  .map((l) => l.slice('- '.length))

/**
 * The value of the one label whose key matches, or undefined.
 *
 * Case-insensitive: Traefik reads `stsSeconds` and `stsseconds` alike, and
 * the file already mixes both styles. A test insisting on one would fail on
 * a correct configuration.
 */
function value(key: RegExp): string | undefined {
  const hit = labels.find((l) => key.test(l.slice(0, l.indexOf('='))))
  return hit?.slice(hit.indexOf('=') + 1)
}

/** A router label, by the part of its key that follows the router name. */
function router(suffix: string): RegExp {
  return new RegExp(`^traefik\\.http\\.routers\\.app-\\S+\\.${suffix}$`, 'i')
}

describe('the router', () => {
  it('answers on the apex AND on www', () => {
    const rule = value(router('rule')) ?? ''
    expect(rule).toMatch(/Host\(`[^`]*URL_HOST[^`]*`\)/)
    expect(rule).toMatch(/Host\(`www\./)
  })

  // A container that declares more than one Traefik service sees any router
  // without a `.service` label discarded, silently.
  it('names its own service', () => {
    expect(value(router('service'))).toBeDefined()
  })

  // Inheriting the shared VPS Traefik's defaults means another project can
  // move this site's entrypoint without touching this repository.
  it('names its entrypoint rather than inheriting it', () => {
    expect(value(router('entrypoints'))).toBeDefined()
  })

  it('asks for a certificate explicitly', () => {
    expect(value(router('tls\\.certresolver'))).toBeDefined()
  })
})

describe('the middlewares', () => {
  /** Those the router actually chains, in order. */
  const chained = (value(router('middlewares')) ?? '')
    .split(',')
    .filter(Boolean)
    .map((m) => m.replace(/@docker$/, ''))

  /** Those declared by a `traefik.http.middlewares.<name>.…` label. */
  const declared = [
    ...new Set(
      labels
        .map((l) => l.match(/^traefik\.http\.middlewares\.([^.]+)\./i)?.[1])
        .filter((n): n is string => Boolean(n)),
    ),
  ]

  // The trap: `middlewares=` is a single comma-separated value. Adding a
  // second middleware by writing the label again keeps only the last, and the
  // first disappears without a word.
  it('chains every middleware it declares', () => {
    expect([...chained].sort()).toEqual([...declared].sort())
  })

  it('sends www to the apex', () => {
    expect(declared.some((n) => n.startsWith('www-to-apex'))).toBe(true)
  })

  it('asks browsers to stay on HTTPS', () => {
    const sts = labels.find((l) => l.toLowerCase().includes('.headers.stsseconds='))
    expect(sts).toBeDefined()
    expect(Number(sts?.split('=')[1])).toBeGreaterThanOrEqual(15552000)
  })

  // Preloading is baked into browsers and cannot be taken back for months:
  // not while the domain is young.
  it('does not ask for HSTS preloading', () => {
    expect(labels.some((l) => l.toLowerCase().includes('stspreload=true'))).toBe(false)
  })
})
