import { createCipheriv, randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Le chiffrement des jetons tiers, testé hors contexte Nuxt : on simule
 * useRuntimeConfig, qui est la seule dépendance du module.
 */
const CLE = randomBytes(32).toString('base64')
let cleCourante = CLE

vi.stubGlobal('useRuntimeConfig', () => ({ secretEncryptionKey: cleCourante }))
vi.stubGlobal('createError', (o: { statusMessage?: string }) => new Error(o.statusMessage ?? 'err'))

const { chiffrer, dechiffrer } = await import('../../server/utils/crypto')

beforeEach(() => {
  cleCourante = CLE
})

describe('chiffrement des secrets', () => {
  it('fait l’aller-retour', () => {
    const jeton = 'IGQWRO...un-jeton-instagram-de-longue-duree'
    expect(dechiffrer(chiffrer(jeton))).toBe(jeton)
  })

  it('supporte l’accentuation et les chaînes vides', () => {
    for (const v of ['', 'é à ù — “guillemets”', '🔑']) {
      expect(dechiffrer(chiffrer(v))).toBe(v)
    }
  })

  it('produit un texte chiffré DIFFÉRENT à chaque fois', () => {
    // Un IV réutilisé avec GCM casse la confidentialité ET
    // l'authentification d'un coup. Deux chiffrements du même clair
    // doivent donc différer.
    const a = chiffrer('même valeur')
    const b = chiffrer('même valeur')
    expect(a).not.toBe(b)
    expect(dechiffrer(a)).toBe(dechiffrer(b))
  })

  it('ne laisse jamais le clair apparaître', () => {
    expect(chiffrer('mot-de-passe-très-secret')).not.toContain('secret')
  })

  it('REFUSE un message altéré', () => {
    // C'est tout l'intérêt d'un chiffrement authentifié : une modification
    // est détectée, elle ne produit pas du bruit qu'on prendrait pour bon.
    const scelle = chiffrer('valeur')
    const parts = scelle.split('.')
    const altere = [parts[0], parts[1], parts[2], Buffer.from('autre').toString('base64')].join('.')
    expect(() => dechiffrer(altere)).toThrow()
  })

  it('REFUSE une étiquette d’authentification bidouillée', () => {
    const parts = chiffrer('valeur').split('.')
    const faux = [parts[0], parts[1], randomBytes(16).toString('base64'), parts[3]].join('.')
    expect(() => dechiffrer(faux)).toThrow()
  })

  it('refuse un format inconnu', () => {
    for (const mauvais of ['', 'nimporte', 'v2.a.b.c', 'v1.a.b']) {
      expect(() => dechiffrer(mauvais)).toThrow()
    }
  })

  it('refuse une clé de mauvaise taille, plutôt que de chiffrer faiblement', () => {
    cleCourante = randomBytes(16).toString('base64')
    expect(() => chiffrer('x')).toThrow(/32 octets/)
  })

  it('refuse une clé absente', () => {
    cleCourante = ''
    expect(() => chiffrer('x')).toThrow(/NUXT_SECRET_ENCRYPTION_KEY/)
  })

  it('ne déchiffre pas avec une AUTRE clé', () => {
    const scelle = chiffrer('valeur')
    cleCourante = randomBytes(32).toString('base64')
    expect(() => dechiffrer(scelle)).toThrow()
  })
})
