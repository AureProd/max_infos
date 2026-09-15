import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('createError', (o: { statusCode?: number; statusMessage?: string }) =>
  Object.assign(new Error(o.statusMessage ?? 'erreur'), { statusCode: o.statusCode }),
)

const { checkedFeedUrl } = await import('../../server/utils/substack-import')

/**
 * The server goes and fetches an address a human typed. Without a guard,
 * an editor turns the site into a probe for the VPS's own network — the
 * database, the metadata service of the host, anything listening on
 * localhost. That is the whole point of this file.
 */

describe('the address the server agrees to fetch', () => {
  it('accepts a Substack feed', () => {
    expect(checkedFeedUrl('https://unmaxdinfo.substack.com/feed')).toBe(
      'https://unmaxdinfo.substack.com/feed',
    )
  })

  it('refuses everything that is not Substack', () => {
    for (const url of [
      'https://exemple.test/feed',
      'https://substack.com.exemple.test/feed',
      'https://unmaxdinfo.substack.com.evil.test/feed',
    ]) {
      expect(() => checkedFeedUrl(url)).toThrowError()
    }
  })

  it('refuses the schemes that reach inside the machine', () => {
    // http would also allow a downgrade and a redirect towards the inside.
    for (const url of [
      'http://unmaxdinfo.substack.com/feed',
      'file:///etc/passwd',
      'gopher://substack.com/',
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:5432/',
    ]) {
      expect(() => checkedFeedUrl(url)).toThrowError()
    }
  })

  it('refuses what is not an address at all', () => {
    for (const url of ['', '   ', 'unmaxdinfo.substack.com', 'pas une url']) {
      expect(() => checkedFeedUrl(url)).toThrowError()
    }
  })

  it('answers 409 on an empty address, because nothing is configured yet', () => {
    // Not 422: the request is fine, the site simply has no feed recorded.
    expect(() => checkedFeedUrl('')).toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  it('answers 422 on an address it will not fetch', () => {
    expect(() => checkedFeedUrl('https://exemple.test/feed')).toThrowError(
      expect.objectContaining({ statusCode: 422 }),
    )
  })
})

describe('an address that is not even a string', () => {
  it('is treated as an absent one', () => {
    // The setting has never been written: the field comes back undefined.
    expect(() => checkedFeedUrl(undefined as never)).toThrowError(
      expect.objectContaining({ statusCode: 409 }),
    )
  })
})
