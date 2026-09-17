import { describe, expect, it } from 'vitest'
import { reason } from '#shared/utils/errors'

/**
 * Why the server said no — in one place.
 *
 * Ten screens extracted that message on their own, and nine of them read
 * `statusMessage` alone. Behind Traefik in HTTP/2 that field is empty
 * (see the comment in `SubstackPanel.vue`), so the back-office answered a
 * refused save with a blank error and Max saw a form that would not stick.
 */
describe('reason', () => {
  it('prefers what the API put in the body', () => {
    // `data.message` is the only field that survives HTTP/2 behind Traefik.
    expect(reason({ data: { message: 'Le titre est obligatoire' } })).toBe(
      'Le titre est obligatoire',
    )
  })

  it('falls back to statusMessage, then to message', () => {
    expect(reason({ statusMessage: 'Interdit' })).toBe('Interdit')
    expect(reason({ message: 'Network error' })).toBe('Network error')
  })

  it('skips an empty string rather than showing nothing', () => {
    // ofetch fills `data.message` with '' instead of leaving it out, and an
    // empty reason displays as NO reason — the very silence being fixed.
    expect(reason({ data: { message: '   ' }, statusMessage: 'Interdit' })).toBe('Interdit')
  })

  it('says something even when the error says nothing', () => {
    expect(reason(null)).toBe('Une erreur est survenue')
    expect(reason(undefined)).toBe('Une erreur est survenue')
    expect(reason({})).toBe('Une erreur est survenue')
  })

  it('lets the caller choose what silence means', () => {
    expect(reason({}, 'Enregistrement impossible')).toBe('Enregistrement impossible')
  })

  it('survives an error that is a bare string', () => {
    expect(reason('boom')).toBe('boom')
  })
})
