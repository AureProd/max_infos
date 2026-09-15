import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ secretEncryptionKey: '' }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))

const { readMedia, shortcodeOf, mediaType } = await import('../../server/utils/instagram')
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

describe('traduction du vocabulaire de Meta', () => {
  it('reconnaît un reel à son media_product_type', () => {
    expect(mediaType(media('a', { media_product_type: 'REELS', media_type: 'VIDEO' }))).toBe('reel')
  })

  it('reconnaît un carrousel', () => {
    expect(mediaType(media('a', { media_type: 'CAROUSEL_ALBUM' }))).toBe('carousel')
  })

  it('reconnaît une image', () => {
    expect(mediaType(media('a'))).toBe('image')
  })

  it('retombe sur « post » pour le reste', () => {
    expect(mediaType(media('a', { media_type: 'VIDEO' }))).toBe('post')
  })
})

describe('extraction du code court', () => {
  it('accepte /p/, /reel/, /reels/ et /tv/', () => {
    for (const shape of ['p', 'reel', 'reels', 'tv']) {
      expect(shortcodeOf(`https://www.instagram.com/${shape}/ABC123/`)).toBe('ABC123')
    }
  })

  it('ignore les paramètres', () => {
    expect(shortcodeOf('https://www.instagram.com/p/ABC123/?igsh=xyz')).toBe('ABC123')
  })

  it('renvoie null sur une adresse qui n’en est pas une', () => {
    expect(shortcodeOf('https://exemple.test/p/ABC')).toBeNull()
    expect(shortcodeOf('')).toBeNull()
  })
})

describe('pagination', () => {
  it('suit les pages jusqu’au bout', async () => {
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

  it('ne passe les paramètres qu’au PREMIER appel', async () => {
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

  it('S’ARRÊTE, même si la pagination boucle', async () => {
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

  it('supporte une réponse vide', async () => {
    const http = vi.fn(async () => ({ data: [] })) as unknown as HttpClient
    expect(await readMedia('jeton', http)).toEqual([])
  })

  it('laisse remonter une erreur de l’API', async () => {
    // An expired token or a reached quota must interrupt the sync, not make
    // it look successful with zero posts.
    const http = vi.fn(async () => {
      throw new Error('OAuthException: token expired')
    }) as unknown as HttpClient
    await expect(readMedia('jeton', http)).rejects.toThrow(/token expired/)
  })
})
