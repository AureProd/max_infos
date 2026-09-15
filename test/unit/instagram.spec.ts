import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ secretEncryptionKey: '' }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))

const { readMedia, shortcodeOf, mediaType, refreshToken, readProfile } = await import(
  '../../server/utils/instagram'
)
type HttpClient = Parameters<typeof readMedia>[1]

/**
 * Le client Instagram, contre un client HTTP SIMULÉ.
 *
 * Project rule: no test touches the network. Meta, Google and R2 are
 * stubbed, and the suite runs without a connection.
 */

const media = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  media_type: 'IMAGE' as const,
  permalink: `https://www.instagram.com/p/${id}/`,
  timestamp: '2026-09-10T12:00:00+0000',
  ...extra,
})

describe("translating Meta's vocabulary", () => {
  it('recognises a reel by its media_product_type', () => {
    expect(mediaType(media('a', { media_product_type: 'REELS', media_type: 'VIDEO' }))).toBe('reel')
  })

  it('recognises a carousel', () => {
    expect(mediaType(media('a', { media_type: 'CAROUSEL_ALBUM' }))).toBe('carousel')
  })

  it('recognises an image', () => {
    expect(mediaType(media('a'))).toBe('image')
  })

  it('falls back to « post » for the rest', () => {
    expect(mediaType(media('a', { media_type: 'VIDEO' }))).toBe('post')
  })
})

describe('shortcode extraction', () => {
  it('accepts /p/, /reel/, /reels/ and /tv/', () => {
    for (const shape of ['p', 'reel', 'reels', 'tv']) {
      expect(shortcodeOf(`https://www.instagram.com/${shape}/ABC123/`)).toBe('ABC123')
    }
  })

  it('ignores the parameters', () => {
    expect(shortcodeOf('https://www.instagram.com/p/ABC123/?igsh=xyz')).toBe('ABC123')
  })

  it('returns null on an address that is not one', () => {
    expect(shortcodeOf('https://exemple.test/p/ABC')).toBeNull()
    expect(shortcodeOf('')).toBeNull()
  })
})

describe('pagination', () => {
  it('follows the pages to the end', async () => {
    const pages = [
      { data: [media('1'), media('2')], paging: { next: 'https://suite/2' } },
      { data: [media('3')], paging: { next: 'https://suite/3' } },
      { data: [media('4')] },
    ]
    let call = 0
    const http = vi.fn(async () => pages[call++]) as unknown as HttpClient

    const all = await readMedia('jeton', http)
    expect(all.map((m) => m.id)).toEqual(['1', '2', '3', '4'])
  })

  it('only passes the parameters on the FIRST call', async () => {
    // Meta's « next » URL already carries its own: sending them again would
    // produce an invalid request.
    const calls: { url: string; query?: Record<string, string> }[] = []
    const pages = [{ data: [media('1')], paging: { next: 'https://suite?after=x' } }, { data: [] }]
    let i = 0
    const http = vi.fn(async (url: string, o?: { query?: Record<string, string> }) => {
      calls.push({ url, query: o?.query })
      return pages[i++]
    }) as unknown as HttpClient

    await readMedia('jeton', http)
    expect(calls[0]?.query?.access_token).toBe('jeton')
    expect(calls[1]?.query).toBeUndefined()
  })

  it('STOPS, even when the pagination loops', async () => {
    // Unbounded, a pagination that repeats itself would keep the sync
    // running forever, burning the API quota.
    const http = vi.fn(async () => ({
      data: [media('boucle')],
      paging: { next: 'https://toujours-la-meme' },
    })) as unknown as HttpClient

    const all = await readMedia('jeton', http, 5)
    expect(all).toHaveLength(5)
    expect(http).toHaveBeenCalledTimes(5)
  })

  it('supports an empty response', async () => {
    const http = vi.fn(async () => ({ data: [] })) as unknown as HttpClient
    expect(await readMedia('jeton', http)).toEqual([])
  })

  it('lets an API error bubble up', async () => {
    // An expired token or a reached quota must interrupt the sync, not make
    // it look successful with zero posts.
    const http = vi.fn(async () => {
      throw new Error('OAuthException: token expired')
    }) as unknown as HttpClient
    await expect(readMedia('jeton', http)).rejects.toThrow(/token expired/)
  })
})

describe('the calls made to Meta', () => {
  it('refreshes a long-lived token with the grant Meta expects', async () => {
    // `ig_refresh_token` and nothing else: with the wrong grant, Meta answers
    // 400 and the integration dies at the end of the token's sixty days.
    const http = vi.fn(async () => ({ access_token: 'neuf', expires_in: 5_184_000 }))
    const r = await refreshToken('ancien', http as never)

    expect(r.access_token).toBe('neuf')
    const [url, options] = http.mock.calls[0] as unknown as [
      string,
      { query: Record<string, string> },
    ]
    expect(url).toContain('/refresh_access_token')
    expect(options.query).toEqual({ grant_type: 'ig_refresh_token', access_token: 'ancien' })
  })

  it('asks the profile for exactly the fields the site displays', async () => {
    const http = vi.fn(async () => ({ id: '1', username: 'unmaxdinfo' }))
    await readProfile('jeton', http as never)

    const [url, options] = http.mock.calls[0] as unknown as [
      string,
      { query: Record<string, string> },
    ]
    expect(url).toContain('/me')
    expect(options.query.access_token).toBe('jeton')
    expect(options.query.fields?.split(',')).toEqual([
      'id',
      'username',
      'name',
      'biography',
      'profile_picture_url',
      'followers_count',
      'media_count',
    ])
  })

  it('falls back on $fetch when no client is injected', async () => {
    // The default client is what production uses; leaving it unexercised
    // would let a typo in the URL through.
    const fetchStub = vi.mocked(globalThis.$fetch as unknown as ReturnType<typeof vi.fn>)
    fetchStub.mockResolvedValueOnce({ data: [] })

    expect(await readMedia('jeton')).toEqual([])
    expect(fetchStub).toHaveBeenCalledWith(
      expect.stringContaining('/me/media'),
      expect.objectContaining({ query: expect.objectContaining({ access_token: 'jeton' }) }),
    )
  })
})
