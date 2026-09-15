import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Stockage des médias sur Cloudflare R2, compatible S3.
 *
 * Le téléversement se fait par URL PRÉSIGNÉE : le navigateur envoie le
 * file directement à R2, sans passer par notre serveur. Trois raisons —
 * le file ne traverse pas Nitro, la mémoire du conteneur ne monte pas
 * avec la size des images, et le serveur ne devient pas un relais ouvert.
 */

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'application/pdf',
])

export function allowedType(contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType.toLowerCase())
}

export function kindOf(contentType: string): 'image' | 'pdf' {
  return contentType.toLowerCase() === 'application/pdf' ? 'pdf' : 'image'
}

/**
 * Fabrique la clé de stockage.
 *
 * Préfixée par la date pour que le bucket reste navigable, suffixée d'un
 * identifiant aléatoire pour que two files du même name ne s'écrasent
 * pas — ce qui arriverait au first « capture.png ».
 */
export function keyOf(filename: string): string {
  const clean = filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(-80)
  const day = new Date().toISOString().slice(0, 10)
  return `${day}/${randomUUID().slice(0, 8)}-${clean || 'fichier'}`
}

let client: S3Client | undefined

function useS3(): S3Client {
  if (!client) {
    const c = useRuntimeConfig()
    if (!c.r2Endpoint || !c.r2AccessKeyId) {
      throw createError({
        statusCode: 503,
        statusMessage: "Le stockage n'est pas configuré (voir NUXT_R2_*)",
      })
    }
    client = new S3Client({
      region: 'auto',
      endpoint: c.r2Endpoint,
      credentials: { accessKeyId: c.r2AccessKeyId, secretAccessKey: c.r2SecretAccessKey },
    })
  }
  return client
}

/** Le stockage est-il configuré ? Permet à l'admin de le dire clairement. */
export function storageConfigured(): boolean {
  const c = useRuntimeConfig()
  return Boolean(c.r2Endpoint && c.r2AccessKeyId && c.r2SecretAccessKey && c.r2Bucket)
}

/** URL de téléversement direct, valable dix minutes. */
export async function uploadUrl(key: string, contentType: string): Promise<string> {
  const c = useRuntimeConfig()
  return await getSignedUrl(
    useS3(),
    new PutObjectCommand({ Bucket: c.r2Bucket, Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  )
}

/** L'adresse publique d'un média, servie par media.unmaxdinfo.fr. */
export function publicUrl(key: string): string {
  const base = useRuntimeConfig().public.r2BaseUrl.replace(/\/+$/, '')
  return `${base}/${key}`
}

export async function removeFromStorage(key: string): Promise<void> {
  const c = useRuntimeConfig()
  await useS3().send(new DeleteObjectCommand({ Bucket: c.r2Bucket, Key: key }))
}

/** Remet le client à zéro. Utilisé par les tests. */
export function resetStorage(): void {
  client = undefined
}
