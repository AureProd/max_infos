import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

/** The two probes, on a real Nitro server connected to the test database. */
await setup({ server: true, browser: false })

describe('sondes', () => {
  it('/api/health répond sans toucher à la base', async () => {
    const r = await $fetch<{ status: string; environment: string; version: string }>('/api/health')
    expect(r.status).toBe('ok')
    expect(r.version).toBeTruthy()
    expect(r.environment).toBeTruthy()
  })

  it('/api/health/ready confirme que la base répond', async () => {
    const r = await $fetch<{ database: string; latencyMs: number }>('/api/health/ready')
    expect(r.database).toBe('ok')
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('les routes d’API ne sont pas avalées par le routeur de pages', async () => {
    const r = await fetch('/api/health')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('application/json')
  })
})
