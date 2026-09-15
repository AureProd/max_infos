import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '~/composables/useUser'
import { useUser } from '~/composables/useUser'

/**
 * What the back-office SHOWS, which is comfort and not security: the
 * server's refusal is what protects, and test/api/authorization.spec.ts
 * checks it route by route.
 */

let current: User | null = null

// Hoisted: mockNuxtImport is lifted above the module body, so anything it
// closes over must exist before that body runs.
const { order, navigate } = vi.hoisted(() => {
  const order: string[] = []
  return {
    order,
    navigate: async () => {
      order.push('navigate')
    },
  }
})

registerEndpoint('/api/auth/me', () => ({ user: current }))
registerEndpoint('/api/auth/logout', () => {
  order.push('logout')
  current = null
  return {}
})

// navigateTo is a Nuxt auto-import, not a global: vi.stubGlobal would not
// intercept it.
mockNuxtImport('navigateTo', () => navigate)

const asUser = (role: User['role']): User => ({
  id: 1,
  email: 'max@exemple.test',
  name: 'Max',
  avatarUrl: null,
  role,
})

beforeEach(() => {
  current = null
})

describe('useUser', () => {
  it('reports nobody signed in, and grants nothing', async () => {
    const { user, signedIn, peut, refresh } = useUser()
    await refresh()

    expect(user.value).toBeNull()
    expect(signedIn.value).toBe(false)
    expect(peut('editor').value).toBe(false)
    expect(peut('tech').value).toBe(false)
  })

  it('opens everything to a tech', async () => {
    current = asUser('tech')
    const { signedIn, peut, refresh } = useUser()
    await refresh()

    expect(signedIn.value).toBe(true)
    expect(peut('editor').value).toBe(true)
    expect(peut('tech').value).toBe(true)
  })

  it('keeps the technical screens shut to an editor', async () => {
    current = asUser('editor')
    const { peut, refresh } = useUser()
    await refresh()

    expect(peut('editor').value).toBe(true)
    expect(peut('tech').value).toBe(false)
  })

  it('signs out, re-reads, then leaves the back-office', async () => {
    // The order matters: leaving without refreshing would keep a stale user
    // in memory for the next page.
    current = asUser('tech')
    order.length = 0

    const { signOut, signedIn, refresh } = useUser()
    await refresh()
    expect(signedIn.value).toBe(true)

    await signOut()

    expect(order).toEqual(['logout', 'navigate'])
    expect(signedIn.value).toBe(false)
  })
})
