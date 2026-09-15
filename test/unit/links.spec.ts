import { describe, expect, it } from 'vitest'
import { parseInstagramUrl } from '../../server/utils/links'

describe('parseInstagramUrl', () => {
  it('recognises the four shapes of address Instagram hands out', () => {
    // Only /p/ is a post; the three others are the same video object under
    // names Instagram has changed over the years.
    expect(parseInstagramUrl('https://www.instagram.com/p/ABC12345/')).toEqual({
      kind: 'p',
      shortcode: 'ABC12345',
    })
    expect(parseInstagramUrl('https://www.instagram.com/reel/ABC12345/')).toEqual({
      kind: 'reel',
      shortcode: 'ABC12345',
    })
    expect(parseInstagramUrl('https://www.instagram.com/reels/ABC12345/')).toEqual({
      kind: 'reel',
      shortcode: 'ABC12345',
    })
    expect(parseInstagramUrl('https://www.instagram.com/tv/ABC12345/')).toEqual({
      kind: 'reel',
      shortcode: 'ABC12345',
    })
  })

  it('ignores the tracking parameters Instagram appends when sharing', () => {
    // This is the form of URL a visitor pastes: the share button adds igsh.
    expect(parseInstagramUrl('https://www.instagram.com/p/ABC12345/?igsh=Mx0yZg%3D%3D')).toEqual({
      kind: 'p',
      shortcode: 'ABC12345',
    })
  })

  it('accepts a bare shortcode, which is what the admin screen types', () => {
    expect(parseInstagramUrl('ABC12345')).toEqual({ kind: 'p', shortcode: 'ABC12345' })
    expect(parseInstagramUrl('  ABC12345  ')).toEqual({ kind: 'p', shortcode: 'ABC12345' })
    expect(parseInstagramUrl('A_b-1')).toEqual({ kind: 'p', shortcode: 'A_b-1' })
  })

  it('returns null rather than throwing on anything it cannot read', () => {
    // The caller is a route handler: a null becomes a 422, an exception a 500.
    expect(parseInstagramUrl('')).toBeNull()
    expect(parseInstagramUrl('   ')).toBeNull()
    expect(parseInstagramUrl(null)).toBeNull()
    expect(parseInstagramUrl(undefined)).toBeNull()
    expect(parseInstagramUrl(42)).toBeNull()
    expect(parseInstagramUrl('abc')).toBeNull()
    expect(parseInstagramUrl('https://www.instagram.com/p/abc/')).toBeNull()
  })

  it('does not take another site for Instagram', () => {
    // The host is part of the pattern: a look-alike domain must not pass.
    expect(parseInstagramUrl('https://exemple.test/p/ABC12345')).toBeNull()
    expect(parseInstagramUrl('https://www.instagram.com/unmaxdinfo/')).toBeNull()
  })
})
