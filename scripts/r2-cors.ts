/**
 * Applies the CORS rule of the R2 media bucket.
 *
 *   NUXT_R2_ENDPOINT=… NUXT_R2_ACCESS_KEY_ID=… \
 *   NUXT_R2_SECRET_ACCESS_KEY=… NUXT_R2_BUCKET=… pnpm r2:cors
 *
 * Why this script exists: the browser uploads the file DIRECTLY to R2,
 * through a presigned URL, so the request never goes through Nitro. Its
 * `content-type` makes it a non-simple request, the browser therefore sends
 * a preflight OPTIONS, and a bucket without a CORS rule answers it without
 * an Access-Control-Allow-Origin header. The upload then fails as a bare
 * `TypeError: Failed to fetch` — no status code, nothing in the server logs,
 * which is what made this cost an afternoon.
 *
 * It reads the credentials from the environment and writes nothing to the
 * repository: the repository is public.
 *
 * Idempotent: PutBucketCors replaces the whole set of rules. The script then
 * READS the configuration back and prints what the bucket really answers —
 * a script that claims success without re-reading proves nothing.
 */
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * The origins allowed to upload. `localhost:8000` is the local development
 * site, the only place where the scheme is http — in production the site is
 * HTTPS and nothing else.
 */
const ORIGINS = ['https://unmaxdinfo.fr', 'https://www.unmaxdinfo.fr', 'http://localhost:8000']

/**
 * `content-type` is enough: MediaPicker sends that header and no other, the
 * rest of the signature travels as URL parameters.
 */
const RULE = {
  AllowedOrigins: ORIGINS,
  AllowedMethods: ['PUT', 'GET', 'HEAD'],
  AllowedHeaders: ['content-type'],
  ExposeHeaders: ['etag'],
  MaxAgeSeconds: 3600,
}

const NEEDED = [
  'NUXT_R2_ENDPOINT',
  'NUXT_R2_ACCESS_KEY_ID',
  'NUXT_R2_SECRET_ACCESS_KEY',
  'NUXT_R2_BUCKET',
] as const

const missing = NEEDED.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error(`/!\\ Variables manquantes : ${missing.join(', ')}`)
  console.error("Ce script ne lit que l'environnement ; aucune clé ne vit dans le dépôt.")
  process.exit(1)
}

const bucket = process.env.NUXT_R2_BUCKET as string

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.NUXT_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY as string,
  },
})

async function main(): Promise<void> {
  console.log(`Seau : ${bucket}`)

  await client.send(
    new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [RULE] } }),
  )

  // Reading back is the whole point: this is what the browser will meet.
  const back = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
  const rules = back.CORSRules ?? []

  console.log(`\nCe que le seau répond, après écriture (${rules.length} règle(s)) :`)
  for (const rule of rules) {
    console.log(`  origines : ${(rule.AllowedOrigins ?? []).join(', ')}`)
    console.log(`  méthodes : ${(rule.AllowedMethods ?? []).join(', ')}`)
    console.log(`  en-têtes : ${(rule.AllowedHeaders ?? []).join(', ')}`)
  }

  const applied = new Set(rules.flatMap((rule) => rule.AllowedOrigins ?? []))
  const absent = ORIGINS.filter((origin) => !applied.has(origin))
  if (absent.length > 0) {
    console.error(`\n/!\\ Origines absentes de la relecture : ${absent.join(', ')}`)
    process.exit(1)
  }

  console.log('\nLes trois origines sont en place. Le téléversement peut passer.')
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n/!\\ Échec : ${message}`)

    // The most likely failure, and the least self-explanatory: an « Object
    // Read & Write » token can upload files but cannot touch the bucket's
    // own configuration. Saying so here saves a search through the docs.
    if (/access denied|forbidden/i.test(message)) {
      console.error(
        [
          '',
          'Ce jeton R2 peut écrire des OBJETS, pas la configuration du seau.',
          'Poser une règle CORS demande un jeton « Admin Read & Write ».',
          '',
          'Deux voies :',
          '  1. Créer un jeton Admin dans Cloudflare (R2 > API > Manage API tokens),',
          '     puis relancer cette commande avec ce jeton.',
          '  2. Ou poser la règle une seule fois à la main :',
          '     Cloudflare > R2 > le seau > Settings > CORS Policy.',
          '     Le script affiche la règle attendue ci-dessous.',
          '',
          JSON.stringify([RULE], null, 2),
        ].join('\n'),
      )
    }
    process.exit(1)
  })
