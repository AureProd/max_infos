import { describe, expect, it, vi } from 'vitest'
import {
  authorizationUrl,
  exchangeCode,
  extendToken,
  redirectUrl,
} from '../../server/utils/instagram'

describe('redirect URI', () => {
  it('is derived from the public URL, without a double slash', () => {
    // One slash of difference from what is declared at Meta is enough to
    // fail the exchange, on a message that does not say why.
    expect(redirectUrl('https://unmaxdinfo.fr')).toBe(
      'https://unmaxdinfo.fr/api/admin/instagram/callback',
    )
    expect(redirectUrl('https://unmaxdinfo.fr/')).toBe(
      'https://unmaxdinfo.fr/api/admin/instagram/callback',
    )
  })
})

describe('authorization URL', () => {
  const url = new URL(authorizationUrl('123', 'https://unmaxdinfo.fr/cb', 'etat-xyz'))

  it('asks ONLY for read access', () => {
    // Le site ne published jamais : il ne doit donc jamais demander la
    // permission to publish. That is a project decision, and it is checked
    // here, at the place where the permission is asked for.
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic')
  })

  it('carries the state, which guards against hijacking', () => {
    expect(url.searchParams.get('state')).toBe('etat-xyz')
    expect(url.searchParams.get('response_type')).toBe('code')
  })
})

describe('code exchange', () => {
  it('sends a form, not JSON', async () => {
    // This Meta endpoint refuses application/json, and says so only
    // par un 400 sans explication.
    const http = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(URLSearchParams)
      return new Response(JSON.stringify({ access_token: 'court' }), { status: 200 })
    })
    const token = await exchangeCode('code', 'id', 'secret', 'https://x/cb', http as never)
    expect(token).toBe('court')
  })

  it('fails plainly when Instagram refuses', async () => {
    const http = vi.fn(async () => new Response('non', { status: 400 }))
    await expect(exchangeCode('c', 'i', 's', 'u', http as never)).rejects.toThrow(/400/)
  })
})

describe('token extension', () => {
  it('does ask for a LONG-lived token', async () => {
    // Forgetting this second exchange gives an integration that works for
    // an hour then dies: the short-lived token cannot be refreshed.
    const http = vi.fn(async (_u: string, o?: { query?: Record<string, string> }) => {
      expect(o?.query?.grant_type).toBe('ig_exchange_token')
      return { access_token: 'long' } as never
    })
    expect(await extendToken('court', 'secret', http as never)).toBe('long')
  })
})
