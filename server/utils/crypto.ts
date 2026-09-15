import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Encryption of third-party tokens stored in the database (`secret` table).
 *
 * AES-256-GCM with the native `node:crypto`. The plan mentioned Fernet,
 * which does not exist in Node: rather than reimplementing it — the worst
 * idea in cryptography — we use the standard primitive offering the same
 * guarantee, AUTHENTICATED encryption. Any tampering with the message is
 * caught on decryption; it does not yield usable noise.
 *
 * Format: v1.<iv base64>.<tag base64>.<ciphertext base64>
 * The leading version will allow changing algorithm without having to guess
 * how the older values were produced.
 */

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
const IV_SIZE = 12 // recommended for GCM
const KEY_SIZE = 32 // AES-256

function key(): Buffer {
  const raw = useRuntimeConfig().secretEncryptionKey
  if (!raw) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_SECRET_ENCRYPTION_KEY n'est pas renseignée",
    })
  }
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== KEY_SIZE) {
    throw createError({
      statusCode: 500,
      statusMessage: `La clé de chiffrement doit faire ${KEY_SIZE} octets en base64 (openssl rand -base64 32)`,
    })
  }
  return bytes
}

export function encrypt(plain: string): string {
  // A RANDOM IV per message: reusing an IV with GCM is the mistake that
  // breaks confidentiality AND authentication at once.
  const iv = randomBytes(IV_SIZE)
  const c = createCipheriv(ALGO, key(), iv)
  const encrypted = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.')
}

export function decrypt(sealed: string): string {
  const parts = sealed.split('.')
  const [version, ivB64, tagB64, cipherB64] = parts
  // We check the STRUCTURE, not emptiness: encrypting an empty string
  // legitimately yields an empty ciphertext, and a falsy test rejected it.
  if (parts.length !== 4 || version !== VERSION || !ivB64 || !tagB64) {
    throw createError({ statusCode: 500, statusMessage: 'Format de secret non reconnu' })
  }
  const d = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
  d.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([d.update(Buffer.from(cipherB64 ?? '', 'base64')), d.final()]).toString(
    'utf8',
  )
}
