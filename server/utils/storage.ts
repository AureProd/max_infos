import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Media storage on Cloudflare R2, S3-compatible.
 *
 * Uploads go through a PRESIGNED URL: the browser sends the file straight
 * to R2, without passing through our server. Three reasons — the file does
 * not cross Nitro, container memory does not grow with image size, and the
 * server does not become an open relay.
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
 * Builds the storage key.
 *
 * Prefixed with the date so the bucket stays browsable, suffixed with a
 * random identifier so that two files of the same name do not overwrite
 * each other — which would happen on the very first « capture.png ».
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
      // A presigned URL is signed WITHOUT a body. Left to itself the SDK
      // signs the CRC32 of nothing, R2 compares it to the file the browser
      // actually sends, and refuses the upload.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }
  return client
}

/** Is storage configured? Lets the admin say so plainly. */
export function storageConfigured(): boolean {
  const c = useRuntimeConfig()
  return Boolean(c.r2Endpoint && c.r2AccessKeyId && c.r2SecretAccessKey && c.r2Bucket)
}

/** Direct upload URL, valid for ten minutes. */
export async function uploadUrl(key: string, contentType: string): Promise<string> {
  const c = useRuntimeConfig()
  return await getSignedUrl(
    useS3(),
    new PutObjectCommand({ Bucket: c.r2Bucket, Key: key, ContentType: contentType }),
    { expiresIn: 600 },
  )
}

/** A medium's public address, served by media.unmaxdinfo.fr. */
export function publicUrl(key: string): string {
  const base = useRuntimeConfig().public.r2BaseUrl.replace(/\/+$/, '')
  return `${base}/${key}`
}

export async function removeFromStorage(key: string): Promise<void> {
  const c = useRuntimeConfig()
  await useS3().send(new DeleteObjectCommand({ Bucket: c.r2Bucket, Key: key }))
}

/** Resets the client. Used by the tests. */
export function resetStorage(): void {
  client = undefined
}
