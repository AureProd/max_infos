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

/** The same screens, as the options of the narrow-window menu. */
const choices = async () => {
  const menu = (await mountSuspended(AdminLayout)).find('.admin-menu-select')
  return menu.findAll('option').map((o) => ({
    value: o.attributes('value'),
    label: o.text(),
  }))
}

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

/**
 * Sous 900px le menu devient UN select.
 *
 * Les deux coexistent dans le document, et c'est le CSS qui montre l'un ou
 * l'autre : brancher sur la largeur en JavaScript casserait l'hydratation,
 * le serveur ne connaissant pas la taille de la fenêtre. D'où ce test — la
 * liste dupliquée est le risque, et il faut qu'elle ne diverge jamais.
 */
describe('le menu des petites fenêtres', () => {
  it('offre exactement les écrans que les liens offrent', async () => {
    role.value = 'tech'
    const links = (await nav()).map((a) => a.attributes('href'))
    const options = (await choices()).map((o) => o.value)
    // Les liens comprennent la marque, qui pointe aussi vers /admin, et les
    // deux boutons de droite : on ne compare que ce que le menu propose.
    for (const option of options) expect(links).toContain(option)
    expect(options).toContain('/admin/tech')
  })

  it("ne propose pas non plus à un éditeur l'écran technique", async () => {
    role.value = 'editor'
    expect((await choices()).map((o) => o.value)).not.toContain('/admin/tech')
    role.value = 'tech'
  })

  it('nomme les écrans comme le menu les nomme', async () => {
    role.value = 'tech'
    expect((await choices()).map((o) => o.label)).toContain('Tableau de bord')
  })
})
