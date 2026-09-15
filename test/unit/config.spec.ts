import { describe, expect, it } from 'vitest'
import { parseConfig, SECRETS_REQUIRED_IN_PROD, variableName } from '#shared/schemas/config'

/**
 * A port of the old backend/tests/test_config.py tests: the rule « a failed
 * startup beats an open production » is carried over as is.
 */

const MINIMAL_CONFIG = {
  databaseUrl: '',
  secretEncryptionKey: '',
  session: { password: '', name: 'umdi_session' },
  oauth: { google: { clientId: '', clientSecret: '' } },
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

// Dummy values: only their PRESENCE is tested, never their content.
const PROD_SECRETS = {
  databaseUrl: 'postgres://u:p@db:5432/d',
  secretEncryptionKey: 'k'.repeat(44),
  session: { password: 's'.repeat(64), name: 'umdi_session' },
  oauth: { google: { clientId: 'id', clientSecret: 'cs' } },
}

describe('configuration', () => {
  it('accepte une configuration vide en développement', () => {
    const c = parseConfig(MINIMAL_CONFIG)
    expect(c.public.appEnv).toBe('dev')
    expect(c.secretEncryptionKey).toBe('')
    expect(c.session.password).toBe('')
  })

  it('accepte preview sans secret', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'preview' } }),
    ).not.toThrow()
  })

  it('refuse de démarrer en production sans secret', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'prod' } }),
    ).toThrow(/manquantes en production/)
  })

  it('nomme les variables manquantes, triées, sous leur nom d’environnement', () => {
    let message = ''
    try {
      parseConfig({
        ...MINIMAL_CONFIG,
        ...PROD_SECRETS,
        session: { password: '', name: 'umdi_session' },
        oauth: { google: { clientId: '', clientSecret: 'cs' } },
        public: { ...MINIMAL_CONFIG.public, appEnv: 'prod' },
      })
    } catch (e) {
      message = (e as Error).message
    }
    // The operator reads an environment variable name, not a TypeScript key.
    expect(message).toContain('NUXT_OAUTH_GOOGLE_CLIENT_ID')
    expect(message).toContain('NUXT_SESSION_PASSWORD')
    expect(message.indexOf('NUXT_OAUTH_GOOGLE_CLIENT_ID')).toBeLessThan(
      message.indexOf('NUXT_SESSION_PASSWORD'),
    )
    expect(message).not.toContain('NUXT_DATABASE_URL')
  })

  it('démarre en production dès que tous les secrets sont présents', () => {
    const c = parseConfig({
      ...MINIMAL_CONFIG,
      ...PROD_SECRETS,
      public: { ...MINIMAL_CONFIG.public, appEnv: 'prod' },
    })
    expect(c.public.appEnv).toBe('prod')
  })

  it('refuse un environnement inconnu', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'staging' } }),
    ).toThrow()
  })

  it('traduit une clé de configuration en nom de variable d’environnement', () => {
    // Known secrets have an EXPLICIT name, because it cannot be derived
    // from the path: nuxt-auth-utils mandates session.password and
    // oauth.google.*.
    expect(variableName('sessionPassword')).toBe('NUXT_SESSION_PASSWORD')
    expect(variableName('googleClientId')).toBe('NUXT_OAUTH_GOOGLE_CLIENT_ID')
    // The others follow the general rule.
    expect(variableName('r2AccessKeyId')).toBe('NUXT_R2_ACCESS_KEY_ID')
  })

  it('la liste des secrets obligatoires est celle du lot 1', () => {
    // Same list as refuse_to_start_in_prod_without_secrets on the Python side.
    expect([...SECRETS_REQUIRED_IN_PROD].sort()).toEqual([
      'databaseUrl',
      'googleClientId',
      'googleClientSecret',
      'secretEncryptionKey',
      'sessionPassword',
    ])
  })
})
