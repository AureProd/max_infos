import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import AdminLayout from '~/layouts/admin.vue'

/**
 * The back-office menu, which now lives in the layout.
 *
 * Hiding the technical screens is COMFORT, not security — the server refuses
 * anyway. What the menu owes the reader is simpler: saying where they are.
 */

const { role } = vi.hoisted(() => ({ role: { value: 'tech' as 'editor' | 'tech' } }))

mockNuxtImport('useUser', () => () => ({
  user: computed(() => ({ id: 1, email: 'jb@exemple.test', name: 'JB', role: role.value })),
  signedIn: computed(() => true),
  peut: (required: string) => computed(() => role.value === 'tech' || required === 'editor'),
  refresh: async () => {},
  signOut: async () => {},
}))

const nav = async () => (await mountSuspended(AdminLayout)).findAll('a')

/**
 * Which entry is lit is proved in test/unit/admin-nav.spec.ts, on a pure
 * function: the routing cannot be exercised from here, since the `admin`
 * middleware bounces an unauthenticated mount to /login before the path is
 * ever read. What is left to check here is what the menu OFFERS.
 */
describe('what the menu offers', () => {
  it('shows the technical screen to a tech', async () => {
    role.value = 'tech'
    const links = await nav()
    expect(links.map((a) => a.attributes('href'))).toContain('/admin/tech')
  })

  it('does not offer an editor a screen the server would refuse', async () => {
    // Comfort: a menu offering forbidden screens makes a tool feel like it
    // was not built for you.
    role.value = 'editor'
    const links = await nav()
    expect(links.map((a) => a.attributes('href'))).not.toContain('/admin/tech')
    role.value = 'tech'
  })
})
