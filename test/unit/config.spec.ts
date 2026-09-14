import { describe, expect, it } from 'vitest'
import { nomVariable, parseConfig, SECRETS_REQUIS_EN_PROD } from '#shared/schemas/config'

/**
 * Transposition des tests de l'ancien backend/tests/test_config.py : la
 * règle « mieux vaut un démarrage qui échoue qu'une production ouverte »
 * est reprise telle quelle.
 */

const CONFIG_MINIMALE = {
  databaseUrl: '',
  secretEncryptionKey: '',
  sessionSecret: '',
  sessionCookieName: 'umdi_session',
  sessionMaxAge: 1_209_600,
  googleClientId: '',
  googleClientSecret: '',
  bootstrapTechEmail: '',
  r2AccountId: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2Bucket: '',
  r2Endpoint: '',
  instagramAppId: '',
  instagramAppSecret: '',
  instagramSyncIntervalMinutes: 60,
  schedulerEnabled: false,
  public: {
    version: '0.1.0',
    appEnv: 'dev',
    baseUrl: 'http://unmaxdinfo.localhost:8080',
    r2BaseUrl: '',
  },
}

// Valeurs factices : seule leur PRÉSENCE est testée, jamais leur contenu.
const SECRETS_DE_PROD = {
  databaseUrl: 'postgres://u:p@db:5432/d', // pragma: allowlist secret
  secretEncryptionKey: 'k'.repeat(44),
  sessionSecret: 's'.repeat(64),
  googleClientId: 'id',
  googleClientSecret: 'cs', // pragma: allowlist secret
}

describe('configuration', () => {
  it('accepte une configuration vide en développement', () => {
    const c = parseConfig(CONFIG_MINIMALE)
    expect(c.public.appEnv).toBe('dev')
    expect(c.secretEncryptionKey).toBe('')
    expect(c.sessionSecret).toBe('')
  })

  it('accepte preview sans secret', () => {
    expect(() =>
      parseConfig({ ...CONFIG_MINIMALE, public: { ...CONFIG_MINIMALE.public, appEnv: 'preview' } }),
    ).not.toThrow()
  })

  it('refuse de démarrer en production sans secret', () => {
    expect(() =>
      parseConfig({ ...CONFIG_MINIMALE, public: { ...CONFIG_MINIMALE.public, appEnv: 'prod' } }),
    ).toThrow(/manquantes en production/)
  })

  it('nomme les variables manquantes, triées, sous leur nom d’environnement', () => {
    let message = ''
    try {
      parseConfig({
        ...CONFIG_MINIMALE,
        ...SECRETS_DE_PROD,
        sessionSecret: '',
        googleClientId: '',
        public: { ...CONFIG_MINIMALE.public, appEnv: 'prod' },
      })
    } catch (e) {
      message = (e as Error).message
    }
    // L'opérateur lit un nom de variable d'environnement, pas une clé TypeScript.
    expect(message).toContain('NUXT_GOOGLE_CLIENT_ID')
    expect(message).toContain('NUXT_SESSION_SECRET')
    expect(message.indexOf('NUXT_GOOGLE_CLIENT_ID')).toBeLessThan(
      message.indexOf('NUXT_SESSION_SECRET'),
    )
    expect(message).not.toContain('NUXT_DATABASE_URL')
  })

  it('démarre en production dès que tous les secrets sont présents', () => {
    const c = parseConfig({
      ...CONFIG_MINIMALE,
      ...SECRETS_DE_PROD,
      public: { ...CONFIG_MINIMALE.public, appEnv: 'prod' },
    })
    expect(c.public.appEnv).toBe('prod')
  })

  it('refuse un environnement inconnu', () => {
    expect(() =>
      parseConfig({ ...CONFIG_MINIMALE, public: { ...CONFIG_MINIMALE.public, appEnv: 'staging' } }),
    ).toThrow()
  })

  it('traduit une clé de configuration en nom de variable d’environnement', () => {
    expect(nomVariable('sessionSecret')).toBe('NUXT_SESSION_SECRET')
    expect(nomVariable('googleClientId')).toBe('NUXT_GOOGLE_CLIENT_ID')
    expect(nomVariable('r2AccessKeyId')).toBe('NUXT_R2_ACCESS_KEY_ID')
  })

  it('la liste des secrets obligatoires est celle du lot 1', () => {
    // Même liste que refuse_to_start_in_prod_without_secrets côté Python.
    expect([...SECRETS_REQUIS_EN_PROD].sort()).toEqual([
      'databaseUrl',
      'googleClientId',
      'googleClientSecret',
      'secretEncryptionKey',
      'sessionSecret',
    ])
  })
})
