import { describe, expect, it } from 'vitest'
import { isCurrentScreen } from '../../app/utils/admin-nav'

/**
 * The back-office menu owes the reader one thing: saying where they are.
 * Exactly one entry lit, and the right one.
 */

const SCREENS = [
  '/admin',
  '/admin/articles',
  '/admin/publications',
  '/admin/social',
  '/admin/home',
  '/admin/about',
  '/admin/appearance',
  '/admin/tech',
]

const litBy = (path: string): string[] => SCREENS.filter((s) => isCurrentScreen(path, s))

describe('exactly one entry is current', () => {
  it('on every screen of the back-office', () => {
    for (const path of SCREENS) {
      expect(litBy(path), `sur ${path}`).toEqual([path])
    }
  })

  it('and on the editing screen, where it is Articles', () => {
    expect(litBy('/admin/ben-mhidi')).toEqual(['/admin/articles'])
    expect(litBy('/admin/un-article-quelconque')).toEqual(['/admin/articles'])
  })
})

describe('the trap of matching by prefix', () => {
  it('does not light the dashboard on every screen', () => {
    // `router-link-active` would: /admin is a prefix of them all.
    expect(isCurrentScreen('/admin/articles', '/admin')).toBe(false)
    expect(isCurrentScreen('/admin/tech', '/admin')).toBe(false)
  })

  it('does not take a reserved screen for an article', () => {
    // `appearance` is a screen, not a slug — that is what RESERVED_SLUGS is.
    for (const screen of SCREENS.filter((s) => s !== '/admin')) {
      expect(isCurrentScreen(screen, '/admin/articles'), screen).toBe(screen === '/admin/articles')
    }
  })

  it('does not light anything outside the back-office', () => {
    expect(litBy('/')).toEqual([])
    expect(litBy('/article/ben-mhidi')).toEqual([])
    expect(litBy('/login')).toEqual([])
  })
})
