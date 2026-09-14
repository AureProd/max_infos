import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Stockage des médias sur Cloudflare R2, compatible S3.
 *
 * Le téléversement se fait par URL PRÉSIGNÉE : le navigateur envoie le
 * fichier directement à R2, sans passer par notre serveur. Trois raisons —
 * le fichier ne traverse pas Nitro, la mémoire du conteneur ne monte pas
 * avec la taille des images, et le serveur ne devient pas un relais ouvert.
 */

const TYPES_ADMIS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'application/pdf',
])

export function typeAdmis(contentType: string): boolean {
  return TYPES_ADMIS.has(contentType.toLowerCase())
}

export function genreDe(contentType: string): 'image' | 'pdf' {
  return contentType.toLowerCase() === 'application/pdf' ? 'pdf' : 'image'
}

/**
 * Fabrique la clé de stockage.
 *
 * Préfixée par la date pour que le bucket reste navigable, suffixée d'un
 * identifiant aléatoire pour que deux fichiers du même nom ne s'écrasent
 * pas — ce qui arriverait au premier « capture.png ».
 */
export function cleDe(filename: string): string {
  const propre = filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(-80)
  const jour = new Date().toISOString().slice(0, 10)
  return `${jour}/${randomUUID().slice(0, 8)}-${propre || 'fichier'}`
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
export function stockageConfigure(): boolean {
  const c = useRuntimeConfig()
  return Boolean(c.r2Endpoint && c.r2AccessKeyId && c.r2SecretAccessKey && c.r2Bucket)
}

/** URL de téléversement direct, valable dix minutes. */
export async function urlDeTeleversement(cle: string, contentType: string): Promise<string> {
  const c = useRuntimeConfig()
  return await getSignedUrl(
    useS3(),
    new PutObjectCommand({ Bucket: c.r2Bucket, Key: cle, ContentType: contentType }),
    { expiresIn: 600 },
  )
}

/** L'adresse publique d'un média, servie par media.unmaxdinfo.fr. */
export function urlPublique(cle: string): string {
  const base = useRuntimeConfig().public.r2BaseUrl.replace(/\/+$/, '')
  return `${base}/${cle}`
}

export async function supprimerDuStockage(cle: string): Promise<void> {
  const c = useRuntimeConfig()
  await useS3().send(new DeleteObjectCommand({ Bucket: c.r2Bucket, Key: cle }))
}

/** Remet le client à zéro. Utilisé par les tests. */
export function reinitialiserStockage(): void {
  client = undefined
}
