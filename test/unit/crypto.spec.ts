import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Encryption of third-party tokens, tested outside the Nuxt context: we
 * stub useRuntimeConfig, the module's only dependency.
 */
const KEY = randomBytes(32).toString('base64')
let currentKey = KEY

vi.stubGlobal('useRuntimeConfig', () => ({ secretEncryptionKey: currentKey }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))

const { encrypt, decrypt } = await import('../../server/utils/crypto')

beforeEach(() => {
  currentKey = KEY
})

describe('secret encryption', () => {
  it('makes the round trip', () => {
    const token = 'IGQWRO...a-long-lived-instagram-token'
    expect(decrypt(encrypt(token))).toBe(token)
  })

  it('supports accents and empty strings', () => {
    for (const v of ['', 'é à ù — “guillemets”', '🔑']) {
      expect(decrypt(encrypt(v))).toBe(v)
    }
  })

  it('produces a DIFFERENT ciphertext every time', () => {
    // An IV reused with GCM breaks confidentiality AND authentication at
    // once. Two encryptions of the same plaintext must therefore differ.
    const a = encrypt('même valeur')
    const b = encrypt('même valeur')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(decrypt(b))
  })

  it('never lets the plaintext show', () => {
    expect(encrypt('mot-de-passe-très-secret')).not.toContain('secret')
  })

  it('REFUSES a tampered message', () => {
    // That is the whole point of authenticated encryption: tampering is
    // detected, it does not yield noise one might take for valid data.
    const sealed = encrypt('valeur')
    const parts = sealed.split('.')
    const altered = [parts[0], parts[1], parts[2], Buffer.from('autre').toString('base64')].join(
      '.',
    )
    expect(() => decrypt(altered)).toThrow()
  })

  it('REFUSES a doctored authentication tag', () => {
    const parts = encrypt('valeur').split('.')
    const falsy = [parts[0], parts[1], randomBytes(16).toString('base64'), parts[3]].join('.')
    expect(() => decrypt(falsy)).toThrow()
  })

  it('refuses an unknown format', () => {
    for (const wrong of ['', 'nimporte', 'v2.a.b.c', 'v1.a.b']) {
      expect(() => decrypt(wrong)).toThrow()
    }
  })

  it('refuses a key of the wrong size, rather than encrypting weakly', () => {
    currentKey = randomBytes(16).toString('base64')
    expect(() => encrypt('x')).toThrow(/32 octets/)
  })

  it('refuses a missing key', () => {
    currentKey = ''
    expect(() => encrypt('x')).toThrow(/NUXT_SECRET_ENCRYPTION_KEY/)
  })

  it('does not decrypt with a DIFFERENT key', () => {
    const sealed = encrypt('valeur')
    currentKey = randomBytes(32).toString('base64')
    expect(() => decrypt(sealed)).toThrow()
  })
})
