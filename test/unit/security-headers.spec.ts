import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Les en-têtes que le site doit poser lui-même.
 *
 * Ils vivaient chez Cloudflare, dont le proxy ne s'exécute plus depuis le
 * passage de `@` et `www` en *DNS only* — décision consignée dans
 * `CLAUDE.md`, prise parce que le défi ACME TLS-ALPN-01 ne traverse pas un
 * proxy. Personne ne les a repris : la réponse n'en portait plus aucun.
 *
 * Ici plutôt que dans les labels Traefik : ils valent aussi en
 * développement, où il n'y a pas de proxy, et un écran qui se laisse
 * encadrer ne le dit pas plus en local qu'en production.
 */
const CONFIG = readFileSync(join(process.cwd(), 'nuxt.config.ts'), 'utf8')

describe('les en-têtes de sécurité', () => {
  it('refusent l’encadrement de la page', () => {
    // Le back-office encadré dans une page tierce, c'est un clic volé :
    // le visiteur croit cliquer sur autre chose.
    expect(CONFIG).toMatch(/frame-ancestors\s+'none'/)
    expect(CONFIG).toMatch(/['"]x-frame-options['"]\s*:\s*['"]DENY['"]/i)
  })

  it('interdisent au navigateur de deviner un type', () => {
    expect(CONFIG).toMatch(/['"]x-content-type-options['"]\s*:\s*['"]nosniff['"]/i)
  })

  it('ne laissent pas fuir l’adresse d’origine vers un autre site', () => {
    expect(CONFIG).toMatch(/['"]referrer-policy['"]\s*:\s*['"]strict-origin-when-cross-origin['"]/i)
  })

  it('les posent sur TOUTE la réponse, pas sur un écran choisi', () => {
    // Une règle par écran est une règle qu'on oublie sur le suivant.
    expect(CONFIG).toMatch(/['"]\/\*\*['"]\s*:\s*\{[^}]*headers/s)
  })
})
