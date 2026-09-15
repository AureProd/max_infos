import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

/** The two probes, on a real Nitro server connected to the test database. */
await setup({ server: true, browser: false })

describe('probes', () => {
  it('/api/health answers without touching the database', async () => {
    const r = await $fetch<{ status: string; environment: string; version: string }>('/api/health')
    expect(r.status).toBe('ok')
    expect(r.version).toBeTruthy()
    expect(r.environment).toBeTruthy()
  })

  it('/api/health/ready confirms the database answers', async () => {
    const r = await $fetch<{ database: string; latencyMs: number }>('/api/health/ready')
    expect(r.database).toBe('ok')
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('the API routes are not swallowed by the page router', async () => {
    const r = await fetch('/api/health')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('application/json')
  })
})
