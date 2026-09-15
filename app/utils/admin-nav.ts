import { RESERVED_SLUGS } from '#shared/utils/slug'

/**
 * Which back-office screen the current path belongs to.
 *
 * Computed rather than left to `router-link-active`, which matches by
 * PREFIX: /admin would light up on every screen of the back-office, and the
 * menu would answer « where am I » wrongly everywhere.
 *
 * The editing screen, /admin/<slug>, keeps Articles lit — it is where Max
 * spends most of his time, and a menu with nothing lit there answers with a
 * shrug. RESERVED_SLUGS is what tells a screen from an article, and a test
 * already keeps that list honest.
 *
 * Pure, and outside the component on purpose: the routing cannot be
 * exercised from a mounted component — the `admin` middleware bounces an
 * unauthenticated test to /login before the path is ever read.
 */
export function isCurrentScreen(path: string, to: string): boolean {
  if (to === '/admin') return path === '/admin'

  if (to === '/admin/articles') {
    if (path.startsWith('/admin/articles')) return true
    const tail = path.startsWith('/admin/') ? path.slice('/admin/'.length) : ''
    return (
      tail !== '' && !tail.includes('/') && !(RESERVED_SLUGS as readonly string[]).includes(tail)
    )
  }

  return path === to || path.startsWith(`${to}/`)
}
