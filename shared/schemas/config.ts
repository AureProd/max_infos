import { z } from 'zod'

/**
 * Validation de la configuration au démarrage.
 *
 * Transposition directe de `refuse_to_start_in_prod_without_secrets` de
 * l'ancien backend/app/core/config.py : mieux vaut un démarrage qui échoue
 * qu'une production ouverte. Les values par défaut restent VIDES, jamais
 * factices, pour que rien ne puisse tourner en production avec un secret de
 * démonstration.
 */

export const ENVIRONMENTS = ['dev', 'preview', 'prod'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * Les secrets sans lesquels la production ne doit pas démarrer. Même list
 * qu'au lot 1 : `postgres_password` y est devenu `databaseUrl`, qui le
 * contient.
 */
export const SECRETS_REQUIRED_IN_PROD = [
  'databaseUrl',
  'secretEncryptionKey',
  'sessionPassword',
  'googleClientId',
  'googleClientSecret',
] as const

/**
 * Où read chaque secret dans la configuration, et sous quel name de variable
 * l'opérateur le renseigne. Les two diffèrent : nuxt-auth-utils impose
 * `session.password` et `oauth.google.*`, qui ne se déduisent pas du name
 * plat qu'on emploie dans les messages.
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
    // nuxt-auth-utils impose ce path et 32 caractères au minimum.
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
  // Seul bloc qui part jusqu'au navigateur.
  public: z.object({
    version: z.string().min(1),
    appEnv: z.enum(ENVIRONMENTS),
    baseUrl: z.string().min(1),
    r2BaseUrl: z.string(),
  }),
})

export type Config = z.infer<typeof configSchema>

/**
 * Traduit une clé de configuration en name de variable d'environnement.
 * L'opérateur qui lit le message d'error cherche `NUXT_SESSION_SECRET`
 * dans son file .env, pas `sessionSecret` dans le code.
 */
export function variableName(key: string): string {
  const known = SECRETS_PATH[key as keyof typeof SECRETS_PATH]
  if (known) return known.variable
  return `NUXT_${key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`
}

/** Lit une value imbriquée, sans supposer qu'elle existe. */
function readPath(objet: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (courant, key) =>
      courant && typeof courant === 'object'
        ? (courant as Record<string, unknown>)[key]
        : undefined,
    objet,
  )
}

/**
 * Valide la configuration, et refuse la production s'il manque un secret.
 * Lève une error dont le message nomme les variables manquantes, triées.
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
