import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

/**
 * Les deux sondes, sur un vrai serveur Nitro.
 *
 * Aucune base n'est nécessaire : c'est justement ce que ces tests
 * établissent — la vivacité ne dépend pas de PostgreSQL, la disponibilité
 * si.
 */
await setup({ server: true, browser: false })

describe('sondes', () => {
  it('/api/health répond sans toucher à la base', async () => {
    const reponse = await $fetch<{ status: string; environment: string; version: string }>(
      '/api/health',
    )
    expect(reponse.status).toBe('ok')
    expect(reponse.version).toBeTruthy()
    expect(reponse.environment).toBeTruthy()
  })

  it('/api/health/ready renvoie 503 quand la base est injoignable', async () => {
    // La configuration de test ne fournit aucune base : la sonde doit le
    // dire clairement plutôt que de laisser passer une erreur 500.
    const reponse = await fetch('/api/health/ready')
    expect(reponse.status).toBe(503)
    expect(((await reponse.json()) as { database: string }).database).toBe('injoignable')
  })

  it('les routes d’API ne sont pas avalées par le routeur de pages', async () => {
    const reponse = await fetch('/api/health')
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('content-type')).toContain('application/json')
  })
})
