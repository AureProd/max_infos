import { describe, expect, it, vi } from 'vitest'
import {
  allongerJeton,
  echangerCode,
  urlAutorisation,
  urlDeRedirection,
} from '../../server/utils/instagram'

describe('URI de redirection', () => {
  it('se déduit de l’URL publique, sans double barre', () => {
    // Une barre oblique d'écart avec ce qui est déclaré chez Meta suffit à
    // faire échouer l'échange, sur un message qui ne dit pas pourquoi.
    expect(urlDeRedirection('https://unmaxdinfo.fr')).toBe(
      'https://unmaxdinfo.fr/api/admin/instagram/callback',
    )
    expect(urlDeRedirection('https://unmaxdinfo.fr/')).toBe(
      'https://unmaxdinfo.fr/api/admin/instagram/callback',
    )
  })
})

describe('URL d’autorisation', () => {
  const url = new URL(urlAutorisation('123', 'https://unmaxdinfo.fr/cb', 'etat-xyz'))

  it('ne demande QUE la lecture', () => {
    // Le site ne publie jamais : il ne doit donc jamais demander la
    // permission de publier. C'est une décision du projet, et elle se
    // vérifie ici, à l'endroit où la permission est demandée.
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic')
  })

  it('porte l’état, qui protège du détournement', () => {
    expect(url.searchParams.get('state')).toBe('etat-xyz')
    expect(url.searchParams.get('response_type')).toBe('code')
  })
})

describe('échange du code', () => {
  it('envoie un formulaire, pas du JSON', async () => {
    // Ce point d'entrée de Meta refuse application/json, et ne le dit que
    // par un 400 sans explication.
    const http = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(URLSearchParams)
      return new Response(JSON.stringify({ access_token: 'court' }), { status: 200 })
    })
    const jeton = await echangerCode('code', 'id', 'secret', 'https://x/cb', http as never)
    expect(jeton).toBe('court')
  })

  it('échoue clairement quand Instagram refuse', async () => {
    const http = vi.fn(async () => new Response('non', { status: 400 }))
    await expect(echangerCode('c', 'i', 's', 'u', http as never)).rejects.toThrow(/400/)
  })
})

describe('allongement du jeton', () => {
  it('demande bien un jeton LONG', async () => {
    // Oublier ce second échange donne une intégration qui marche une heure
    // puis meurt : le jeton court n'est pas rafraîchissable.
    const http = vi.fn(async (_u: string, o?: { query?: Record<string, string> }) => {
      expect(o?.query?.grant_type).toBe('ig_exchange_token')
      return { access_token: 'long' } as never
    })
    expect(await allongerJeton('court', 'secret', http as never)).toBe('long')
  })
})
