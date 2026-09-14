import { z } from 'zod'

/**
 * Validation de la configuration au démarrage.
 *
 * Transposition directe de `refuse_to_start_in_prod_without_secrets` de
 * l'ancien backend/app/core/config.py : mieux vaut un démarrage qui échoue
 * qu'une production ouverte. Les valeurs par défaut restent VIDES, jamais
 * factices, pour que rien ne puisse tourner en production avec un secret de
 * démonstration.
 */

export const ENVIRONNEMENTS = ['dev', 'preview', 'prod'] as const
export type Environnement = (typeof ENVIRONNEMENTS)[number]

/**
 * Les secrets sans lesquels la production ne doit pas démarrer. Même liste
 * qu'au lot 1 : `postgres_password` y est devenu `databaseUrl`, qui le
 * contient.
 */
export const SECRETS_REQUIS_EN_PROD = [
  'databaseUrl',
  'secretEncryptionKey',
  'sessionSecret',
  'googleClientId',
  'googleClientSecret',
] as const

const configSchema = z.object({
  databaseUrl: z.string(),
  secretEncryptionKey: z.string(),
  sessionSecret: z.string(),
  sessionCookieName: z.string().min(1),
  sessionMaxAge: z.coerce.number().int().positive(),
  googleClientId: z.string(),
  googleClientSecret: z.string(),
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
    appEnv: z.enum(ENVIRONNEMENTS),
    baseUrl: z.string().min(1),
    r2BaseUrl: z.string(),
  }),
})

export type Config = z.infer<typeof configSchema>

/**
 * Traduit une clé de configuration en nom de variable d'environnement.
 * L'opérateur qui lit le message d'erreur cherche `NUXT_SESSION_SECRET`
 * dans son fichier .env, pas `sessionSecret` dans le code.
 */
export function nomVariable(cle: string): string {
  return `NUXT_${cle.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`
}

/**
 * Valide la configuration, et refuse la production s'il manque un secret.
 * Lève une erreur dont le message nomme les variables manquantes, triées.
 */
export function parseConfig(brut: unknown): Config {
  const config = configSchema.parse(brut)

  if (config.public.appEnv === 'prod') {
    const manquants = SECRETS_REQUIS_EN_PROD.filter((cle) => !config[cle])
      .map(nomVariable)
      .sort()
    if (manquants.length > 0) {
      throw new Error(
        `Variables d'environnement manquantes en production : ${manquants.join(', ')}`,
      )
    }
  }

  return config
}
