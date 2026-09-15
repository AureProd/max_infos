import { z } from 'zod'

/**
 * Configuration validation at startup.
 *
 * A direct port of `refuse_to_start_in_prod_without_secrets` from the old
 * backend/app/core/config.py: a failed startup beats an open production.
 * Default values stay EMPTY, never dummy, so that nothing can ever run in
 * production on a demonstration secret.
 */

export const ENVIRONMENTS = ['dev', 'preview', 'prod'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * The secrets without which production must not start. Same list as lot 1:
 * `postgres_password` became `databaseUrl`, which contains it.
 */
export const SECRETS_REQUIRED_IN_PROD = [
  'databaseUrl',
  'secretEncryptionKey',
  'sessionPassword',
  'googleClientId',
  'googleClientSecret',
] as const

/**
 * Where to read each secret in the configuration, and under which variable
 * name the operator sets it. The two differ: nuxt-auth-utils mandates
 * `session.password` and `oauth.google.*`, which cannot be derived from the
 * flat name used in messages.
 */
export const SECRETS_PATH: Record<
  (typeof SECRETS_REQUIRED_IN_PROD)[number],
  { path: readonly string[]; variable: string }
> = {
  databaseUrl: { path: ['databaseUrl'], variable: 'NUXT_DATABASE_URL' },
  secretEncryptionKey: {
    path: ['secretEncryptionKey'],
    variable: 'NUXT_SECRET_ENCRYPTION_KEY',
  },
  sessionPassword: { path: ['session', 'password'], variable: 'NUXT_SESSION_PASSWORD' },
  googleClientId: {
    path: ['oauth', 'google', 'clientId'],
    variable: 'NUXT_OAUTH_GOOGLE_CLIENT_ID',
  },
  googleClientSecret: {
    path: ['oauth', 'google', 'clientSecret'],
    variable: 'NUXT_OAUTH_GOOGLE_CLIENT_SECRET',
  },
}

/**
 * A configuration string, AS NITRO REALLY HANDS IT OVER.
 *
 * Nitro runs every environment variable through `destr` before putting it
 * into runtimeConfig: a purely numeric value comes back as a number, and
 * « true » / « false » as booleans. A Meta application identifier is
 * sixteen digits, so `z.string()` refused it — and the site failed to start
 * in production only, where that variable is set.
 *
 * Not `z.coerce.string()`: that one turns `undefined` into the string
 * « undefined », which is truthy, and the production completeness check
 * would then see a missing variable as present.
 */
const text = z.preprocess(
  (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : v),
  z.string(),
)

const configSchema = z.object({
  databaseUrl: text,
  secretEncryptionKey: text,
  session: z.object({
    // nuxt-auth-utils mandates this path and at least 32 characters.
    password: text,
    name: text.refine((v) => v.length > 0).optional(),
  }),
  oauth: z.object({
    google: z.object({
      clientId: text,
      clientSecret: text,
      redirectURL: text.optional(),
    }),
  }),
  bootstrapTechEmail: text,
  r2AccountId: text,
  r2AccessKeyId: text,
  r2SecretAccessKey: text,
  r2Bucket: text,
  r2Endpoint: text,
  instagramAppId: text,
  instagramAppSecret: text,
  instagramSyncIntervalMinutes: z.coerce.number().int().min(5),
  schedulerEnabled: z.coerce.boolean(),
  // The only block that travels all the way to the browser.
  public: z.object({
    version: text.refine((v) => v.length > 0),
    appEnv: z.enum(ENVIRONMENTS),
    baseUrl: text.refine((v) => v.length > 0),
    r2BaseUrl: text,
  }),
})

export type Config = z.infer<typeof configSchema>

/**
 * Turns a configuration key into an environment variable name. The operator
 * reading the error message looks for `NUXT_SESSION_SECRET` in their .env
 * file, not for `sessionSecret` in the code.
 */
export function variableName(key: string): string {
  const known = SECRETS_PATH[key as keyof typeof SECRETS_PATH]
  if (known) return known.variable
  return `NUXT_${key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`
}

/** Reads a nested value, without assuming it exists. */
function readPath(object: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (courant, key) =>
      courant && typeof courant === 'object'
        ? (courant as Record<string, unknown>)[key]
        : undefined,
    object,
  )
}

/**
 * Validates the configuration, and refuses production if a secret is
 * missing. Throws an error whose message names the missing variables,
 * sorted.
 */
export function parseConfig(raw: unknown): Config {
  const config = configSchema.parse(raw)

  if (config.public.appEnv === 'prod') {
    const missing = SECRETS_REQUIRED_IN_PROD.filter(
      (key) => !readPath(config, SECRETS_PATH[key].path),
    )
      .map(variableName)
      .sort()
    if (missing.length > 0) {
      throw new Error(`Variables d'environnement manquantes en production : ${missing.join(', ')}`)
    }
  }

  return config
}
