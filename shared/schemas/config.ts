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

const configSchema = z.object({
  databaseUrl: z.string(),
  secretEncryptionKey: z.string(),
  session: z.object({
    // nuxt-auth-utils mandates this path and at least 32 characters.
    password: z.string(),
    name: z.string().min(1).optional(),
  }),
  oauth: z.object({
    google: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      redirectURL: z.string().optional(),
    }),
  }),
  bootstrapTechEmail: z.string(),
  r2AccountId: z.string(),
  r2AccessKeyId: z.string(),
  r2SecretAccessKey: z.string(),
  r2Bucket: z.string(),
  r2Endpoint: z.string(),
  instagramAppId: z.string(),
  instagramAppSecret: z.string(),
  instagramSyncIntervalMinutes: z.coerce.number().int().min(5),
  schedulerEnabled: z.coerce.boolean(),
  // The only block that travels all the way to the browser.
  public: z.object({
    version: z.string().min(1),
    appEnv: z.enum(ENVIRONMENTS),
    baseUrl: z.string().min(1),
    r2BaseUrl: z.string(),
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
