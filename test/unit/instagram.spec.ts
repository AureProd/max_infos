import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ secretEncryptionKey: '' }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))

const { lireMedias, shortcodeDe, typeDeMedia } = await import('../../server/utils/instagram')
type ClientHttp = Parameters<typeof lireMedias>[1]

/**
 * Le client Instagram, contre un client HTTP SIMULÉ.
 *
 * Règle du projet : aucun test ne touche au réseau. Meta, Google et R2 sont
 * simulés, et la suite tourne sans connexion.
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
    expect(typeDeMedia(media('a', { media_product_type: 'REELS', media_type: 'VIDEO' }))).toBe(
      'reel',
    )
  })

  it('reconnaît un carrousel', () => {
    expect(typeDeMedia(media('a', { media_type: 'CAROUSEL_ALBUM' }))).toBe('carousel')
  })

  it('reconnaît une image', () => {
    expect(typeDeMedia(media('a'))).toBe('image')
  })

  it('retombe sur « post » pour le reste', () => {
    expect(typeDeMedia(media('a', { media_type: 'VIDEO' }))).toBe('post')
  })
})

describe('extraction du code court', () => {
  it('accepte /p/, /reel/, /reels/ et /tv/', () => {
    for (const forme of ['p', 'reel', 'reels', 'tv']) {
      expect(shortcodeDe(`https://www.instagram.com/${forme}/ABC123/`)).toBe('ABC123')
    }
  })

  it('ignore les paramètres', () => {
    expect(shortcodeDe('https://www.instagram.com/p/ABC123/?igsh=xyz')).toBe('ABC123')
  })

  it('renvoie null sur une adresse qui n’en est pas une', () => {
    expect(shortcodeDe('https://exemple.test/p/ABC')).toBeNull()
    expect(shortcodeDe('')).toBeNull()
  })
})

describe('pagination', () => {
  it('suit les pages jusqu’au bout', async () => {
    const pages = [
      { data: [media('1'), media('2')], paging: { next: 'https://suite/2' } },
      { data: [media('3')], paging: { next: 'https://suite/3' } },
      { data: [media('4')] },
    ]
    let appel = 0
    const http = vi.fn(async () => pages[appel++]) as unknown as ClientHttp

    const tout = await lireMedias('jeton', http)
    expect(tout.map((m) => m.id)).toEqual(['1', '2', '3', '4'])
  })

  it('ne passe les paramètres qu’au PREMIER appel', async () => {
    // L'URL « next » de Meta porte déjà les siens : les renvoyer produirait
    // une requête invalide.
    const appels: { url: string; query?: Record<string, string> }[] = []
    const pages = [{ data: [media('1')], paging: { next: 'https://suite?after=x' } }, { data: [] }]
    let i = 0
    const http = vi.fn(async (url: string, o?: { query?: Record<string, string> }) => {
      appels.push({ url, query: o?.query })
      return pages[i++]
    }) as unknown as ClientHttp

    await lireMedias('jeton', http)
    expect(appels[0]?.query?.access_token).toBe('jeton')
    expect(appels[1]?.query).toBeUndefined()
  })

  it('S’ARRÊTE, même si la pagination boucle', async () => {
    // Sans borne, une pagination qui se répète ferait tourner la
    // synchronisation indéfiniment, en consommant le quota de l'API.
    const http = vi.fn(async () => ({
      data: [media('boucle')],
      paging: { next: 'https://toujours-la-meme' },
    })) as unknown as ClientHttp

    const tout = await lireMedias('jeton', http, 5)
    expect(tout).toHaveLength(5)
    expect(http).toHaveBeenCalledTimes(5)
  })

  it('supporte une réponse vide', async () => {
    const http = vi.fn(async () => ({ data: [] })) as unknown as ClientHttp
    expect(await lireMedias('jeton', http)).toEqual([])
  })

  it('laisse remonter une erreur de l’API', async () => {
    // Un jeton expiré ou un quota atteint doit interrompre la synchro, pas
    // la faire passer pour réussie avec zéro publication.
    const http = vi.fn(async () => {
      throw new Error('OAuthException: token expired')
    }) as unknown as ClientHttp
    await expect(lireMedias('jeton', http)).rejects.toThrow(/token expired/)
  })
})
