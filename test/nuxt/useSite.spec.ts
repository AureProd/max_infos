import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { useSite } from '~/composables/useSite'

const handler = vi.fn(() => ({
  identity: { name: 'Site de test', author: 'Autrice' },
}))
registerEndpoint('/api/site', handler)

describe('useSite', () => {
  it('gives back the public settings', async () => {
    const { data } = await useSite()
    expect(data.value).toMatchObject({ identity: { name: 'Site de test' } })
  })

  it('asks once for the whole page, whoever calls it', async () => {
    // The masthead, the footer, the home page and the « about » page all
    // call this composable: without the shared key, that would be four
    // requests for one answer.
    handler.mockClear()
    await Promise.all([useSite(), useSite(), useSite()])
    expect(handler.mock.calls.length).toBeLessThanOrEqual(1)
  })
})
