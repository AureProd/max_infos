import { createCipheriv, randomBytes } from 'node:crypto'
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

describe('chiffrement des secrets', () => {
  it('fait l’aller-retour', () => {
    const token = 'IGQWRO...a-long-lived-instagram-token'
    expect(decrypt(encrypt(token))).toBe(token)
  })

  it('supporte l’accentuation et les chaînes vides', () => {
    for (const v of ['', 'é à ù — “guillemets”', '🔑']) {
      expect(decrypt(encrypt(v))).toBe(v)
    }
  })

  it('produit un texte chiffré DIFFÉRENT à chaque fois', () => {
    // An IV reused with GCM breaks confidentiality AND authentication at
    // once. Two encryptions of the same plaintext must therefore differ.
    const a = encrypt('même valeur')
    const b = encrypt('même valeur')
    expect(a).not.toBe(b)
    expect(decrypt(a)).toBe(decrypt(b))
  })

  it('ne laisse jamais le clair apparaître', () => {
    expect(encrypt('mot-de-passe-très-secret')).not.toContain('secret')
  })

  it('REFUSE un message altéré', () => {
    // That is the whole point of authenticated encryption: tampering is
    // detected, it does not yield noise one might take for valid data.
    const sealed = encrypt('valeur')
    const parts = sealed.split('.')
    const altered = [parts[0], parts[1], parts[2], Buffer.from('autre').toString('base64')].join(
      '.',
    )
    expect(() => decrypt(altered)).toThrow()
  })

  it('REFUSE une étiquette d’authentification bidouillée', () => {
    const parts = encrypt('valeur').split('.')
    const falsy = [parts[0], parts[1], randomBytes(16).toString('base64'), parts[3]].join('.')
    expect(() => decrypt(falsy)).toThrow()
  })

  it('refuse un format inconnu', () => {
    for (const wrong of ['', 'nimporte', 'v2.a.b.c', 'v1.a.b']) {
      expect(() => decrypt(wrong)).toThrow()
    }
  })

  it('refuse une clé de mauvaise size, plutôt que de chiffrer faiblement', () => {
    currentKey = randomBytes(16).toString('base64')
    expect(() => encrypt('x')).toThrow(/32 octets/)
  })

  it('refuse une clé absente', () => {
    currentKey = ''
    expect(() => encrypt('x')).toThrow(/NUXT_SECRET_ENCRYPTION_KEY/)
  })

  it('ne déchiffre pas avec une AUTRE clé', () => {
    const sealed = encrypt('valeur')
    currentKey = randomBytes(32).toString('base64')
    expect(() => decrypt(sealed)).toThrow()
  })
})
