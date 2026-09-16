import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Invalidating the public cache.
 *
 * The public pages are served by `swr` (nuxt.config.ts): the last rendered
 * version is handed out while a new one is prepared. Without invalidation
 * Max saves a change and the site keeps serving the old page — for an hour
 * on /about. This module is what makes the back-office truthful.
 */

const removed: string[] = []
let keys: string[] = []

const storage = {
  getKeys: vi.fn(async (prefix: string) => keys.filter((k) => k.startsWith(prefix))),
  removeItem: vi.fn(async (key: string) => {
    removed.push(key)
  }),
}

vi.stubGlobal('useStorage', () => storage)

const { invalidatePublicCache } = await import('../../server/utils/cache')

beforeEach(() => {
  removed.length = 0
  keys = [
    'nitro:routes:_:index.json',
    'nitro:routes:_:about.json',
    'nitro:routes:_:article:fifa.json',
    'nitro:handlers:something-else.json',
  ]
  vi.clearAllMocks()
})

describe('invalidatePublicCache', () => {
  it('drops every cached public route', async () => {
    await invalidatePublicCache()

    expect(removed).toContain('nitro:routes:_:index.json')
    expect(removed).toContain('nitro:routes:_:about.json')
    expect(removed).toContain('nitro:routes:_:article:fifa.json')
  })

  it('touches only the route cache, not the rest of the storage', async () => {
    await invalidatePublicCache()

    // Wiping the whole cache would also throw away what other features
    // memoise, and turn one save into a cold start for everything.
    expect(removed).not.toContain('nitro:handlers:something-else.json')
  })

  it('stays silent when there is nothing cached yet', async () => {
    keys = []
    await expect(invalidatePublicCache()).resolves.toBeUndefined()
    expect(removed).toEqual([])
  })

  it('never lets a cache failure break the save', async () => {
    // The save already happened. A cache that cannot be cleared must not
    // turn a successful publication into a 500.
    storage.getKeys.mockRejectedValueOnce(new Error('storage down'))
    await expect(invalidatePublicCache()).resolves.toBeUndefined()
  })
})
