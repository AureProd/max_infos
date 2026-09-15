import { describe, expect, it } from 'vitest'
import { parseConfig, SECRETS_REQUIRED_IN_PROD, variableName } from '#shared/schemas/config'

/**
 * Transposition des tests de l'ancien backend/tests/test_config.py : la
 * règle « mieux vaut un démarrage qui échoue qu'une production ouverte »
 * est reprise telle quelle.
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

// Valeurs factices : seule leur PRÉSENCE est testée, jamais leur content.
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
    // L'opérateur lit un name de variable d'environnement, pas une clé TypeScript.
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
    // Les secrets connus ont un name EXPLICITE, parce qu'il ne se déduit pas
    // du path : nuxt-auth-utils impose session.password et oauth.google.*.
    expect(variableName('sessionPassword')).toBe('NUXT_SESSION_PASSWORD')
    expect(variableName('googleClientId')).toBe('NUXT_OAUTH_GOOGLE_CLIENT_ID')
    // Les autres suivent la règle générale.
    expect(variableName('r2AccessKeyId')).toBe('NUXT_R2_ACCESS_KEY_ID')
  })

  it('la liste des secrets obligatoires est celle du lot 1', () => {
    // Même list que refuse_to_start_in_prod_without_secrets côté Python.
    expect([...SECRETS_REQUIRED_IN_PROD].sort()).toEqual([
      'databaseUrl',
      'googleClientId',
      'googleClientSecret',
      'secretEncryptionKey',
      'sessionPassword',
    ])
  })
})
