import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Chiffrement des jetons tiers stockés en base (table `secret`).
 *
 * AES-256-GCM avec le `node:crypto` natif. Le plan parlait de Fernet, qui
 * n'existe pas en Node : plutôt que de le réimplémenter — la pire idée en
 * cryptographie — on utilise la primitive standard qui offre la même
 * garantie, un chiffrement AUTHENTIFIÉ. Toute altération du message est
 * détectée au déchiffrement, elle ne produit pas du bruit exploitable.
 *
 * Format : v1.<iv base64>.<tag base64>.<chiffré base64>
 * La version en tête permettra de changer d'algorithme sans avoir à deviner
 * comment les anciennes valeurs ont été produites.
 */

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
const TAILLE_IV = 12 // recommandation pour GCM
const TAILLE_CLE = 32 // AES-256

function cle(): Buffer {
  const brut = useRuntimeConfig().secretEncryptionKey
  if (!brut) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_SECRET_ENCRYPTION_KEY n'est pas renseignée",
    })
  }
  const octets = Buffer.from(brut, 'base64')
  if (octets.length !== TAILLE_CLE) {
    throw createError({
      statusCode: 500,
      statusMessage: `La clé de chiffrement doit faire ${TAILLE_CLE} octets en base64 (openssl rand -base64 32)`,
    })
  }
  return octets
}

export function chiffrer(clair: string): string {
  // Un IV ALÉATOIRE par message : réutiliser un IV avec GCM est la faute
  // qui casse la confidentialité ET l'authentification d'un coup.
  const iv = randomBytes(TAILLE_IV)
  const c = createCipheriv(ALGO, cle(), iv)
  const chiffre = Buffer.concat([c.update(clair, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), chiffre.toString('base64')].join(
    '.',
  )
}

export function dechiffrer(scelle: string): string {
  const parts = scelle.split('.')
  const [version, ivB64, tagB64, chiffreB64] = parts
  // On vérifie la STRUCTURE, pas la vacuité : chiffrer une chaîne vide
  // produit légitimement un texte chiffré vide, et un test sur la valeur
  // falsy le rejetait.
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64) {
    throw createError({ statusCode: 500, statusMessage: 'Format de secret non reconnu' })
  }
  const d = createDecipheriv(ALGO, cle(), Buffer.from(ivB64, 'base64'))
  d.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([d.update(Buffer.from(chiffreB64 ?? '', 'base64')), d.final()]).toString(
    'utf8',
  )
}
