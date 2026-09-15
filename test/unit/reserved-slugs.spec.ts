import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, slugify } from '#shared/utils/slug'

/**
 * `/admin/<slug>` is the article editor, but Nuxt puts static routes ahead
 * of dynamic ones. A screen added to `app/pages/admin/` therefore silently
 * steals its URL from any article carrying the same slug, which becomes
 * unreachable.
 *
 * This test compares the hand-kept list to the REAL contents of the folder:
 * a screen added tomorrow without being listed turns CI red, naming it.
 */
describe('back-office reserved slugs', () => {
  const screens = readdirSync(join(process.cwd(), 'app/pages/admin'))
    .filter((f) => f.endsWith('.vue') && !f.startsWith('[') && f !== 'index.vue')
    .map((f) => f.replace(/\.vue$/, ''))
    .sort()

  it('covers exactly the screens that exist', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual(screens)
  })

  it('are all slugs a title can produce', () => {
    // If a screen were called « my_screen », no title would produce that
    // slug and the reservation would be useless — better to know.
    for (const s of RESERVED_SLUGS) expect(slugify(s)).toBe(s)
  })
})
