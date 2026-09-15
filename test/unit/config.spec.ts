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
  it('accepts an empty configuration in development', () => {
    const c = parseConfig(MINIMAL_CONFIG)
    expect(c.public.appEnv).toBe('dev')
    expect(c.secretEncryptionKey).toBe('')
    expect(c.session.password).toBe('')
  })

  it('accepts preview without a secret', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'preview' } }),
    ).not.toThrow()
  })

  it('refuses to start in production without a secret', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'prod' } }),
    ).toThrow(/manquantes en production/)
  })

  it('names the missing variables, sorted, under their environment name', () => {
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

  it('starts in production as soon as every secret is present', () => {
    const c = parseConfig({
      ...MINIMAL_CONFIG,
      ...PROD_SECRETS,
      public: { ...MINIMAL_CONFIG.public, appEnv: 'prod' },
    })
    expect(c.public.appEnv).toBe('prod')
  })

  it('refuses an unknown environment', () => {
    expect(() =>
      parseConfig({ ...MINIMAL_CONFIG, public: { ...MINIMAL_CONFIG.public, appEnv: 'staging' } }),
    ).toThrow()
  })

  it('turns a configuration key into an environment variable name', () => {
    // Known secrets have an EXPLICIT name, because it cannot be derived
    // from the path: nuxt-auth-utils mandates session.password and
    // oauth.google.*.
    expect(variableName('sessionPassword')).toBe('NUXT_SESSION_PASSWORD')
    expect(variableName('googleClientId')).toBe('NUXT_OAUTH_GOOGLE_CLIENT_ID')
    // The others follow the general rule.
    expect(variableName('r2AccessKeyId')).toBe('NUXT_R2_ACCESS_KEY_ID')
  })

  it('the list of required secrets is the one from lot 1', () => {
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

describe('what Nitro really hands over', () => {
  /**
   * Nitro runs every environment variable through `destr` before putting it
   * in runtimeConfig. A purely numeric value therefore arrives as a NUMBER,
   * and « true » / « false » as booleans — whatever the schema expects.
   *
   * A Meta application identifier is exactly that: sixteen digits. The site
   * refused to start, in production only, with « instagramAppId: expected
   * string, received number ».
   */
  it('accepts a numeric identifier, and gives it back as a string', () => {
    const config = parseConfig({
      ...MINIMAL_CONFIG,
      instagramAppId: 1234567890123456,
    })
    expect(config.instagramAppId).toBe('1234567890123456')
  })

  it('accepts the same treatment on every secret that could be all digits', () => {
    // A password, a hexadecimal key or a bucket name made only of digits is
    // rare but perfectly legal — and would take the site down the same way.
    const config = parseConfig({
      ...MINIMAL_CONFIG,
      session: { password: 123456789012345, name: 'umdi_session' },
      r2AccountId: 987654321,
      instagramAppSecret: 42,
    })
    expect(config.session.password).toBe('123456789012345')
    expect(config.r2AccountId).toBe('987654321')
    expect(config.instagramAppSecret).toBe('42')
  })

  it('cannot save a digits-only secret longer than Number.MAX_SAFE_INTEGER', () => {
    // A LIMIT, written down rather than hidden: destr has already turned the
    // text into a number by the time the schema sees it, and the lost digits
    // are lost. Recovering them would mean reading process.env ourselves,
    // behind Nitro's back.
    //
    // In practice this bites a purely numeric secret of more than fifteen
    // digits. Meta application identifiers sit just under that ceiling; a
    // hand-picked password must simply not be digits only.
    // Through Number(), not as a literal: written out, the number loses its
    // precision at parse time and the linter rightly says so.
    const tooLong = Number('12345678901234567890')
    const config = parseConfig({ ...MINIMAL_CONFIG, instagramAppId: tooLong })
    expect(config.instagramAppId).not.toBe('12345678901234567890')
    expect(Number.MAX_SAFE_INTEGER).toBe(9007199254740991)
  })

  it('still refuses an absent value, which is not a numeric one', () => {
    // The coercion must not turn a missing variable into the string
    // « undefined »: the production check tests presence, and « undefined »
    // is truthy.
    expect(() => parseConfig({ ...MINIMAL_CONFIG, instagramAppId: undefined })).toThrow()
    expect(() => parseConfig({ ...MINIMAL_CONFIG, r2Bucket: null })).toThrow()
  })
})
