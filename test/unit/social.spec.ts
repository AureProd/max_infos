import { describe, expect, it } from 'vitest'
import { mediaTypeFromUrl } from '../../shared/utils/social'

/**
 * The media type guessed from a permalink.
 *
 * Every link pasted by hand was filed as « image », reels included: the
 * home page then showed a reel as a still photo labelled « Image ».
 */
describe('mediaTypeFromUrl', () => {
  it('recognises a reel', () => {
    expect(mediaTypeFromUrl('https://www.instagram.com/reel/DdGUF5XJbhE/')).toBe('reel')
    expect(mediaTypeFromUrl('https://instagram.com/reels/DdGUF5XJbhE')).toBe('reel')
  })

  it('recognises an ordinary post', () => {
    expect(mediaTypeFromUrl('https://www.instagram.com/p/DdGUF5XJbhE/')).toBe('image')
  })

  it('files a LinkedIn link as a post', () => {
    expect(mediaTypeFromUrl('https://www.linkedin.com/posts/quelquun_activity-123')).toBe('post')
  })

  it('falls back when the link says nothing', () => {
    expect(mediaTypeFromUrl('')).toBe(null)
    expect(mediaTypeFromUrl('https://exemple.test/x')).toBe(null)
  })
})
