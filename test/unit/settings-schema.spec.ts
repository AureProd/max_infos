import { describe, expect, it } from 'vitest'
import {
  contactSchema,
  instagramSchema,
  isSettingKey,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SETTING_SCHEMAS,
  SETTING_SCOPE,
} from '#shared/schemas/settings'

describe('setting keys', () => {
  it('recognises a key and rejects anything else', () => {
    // The guard stands in front of the settings route: what it lets through
    // is written to the database under that name.
    expect(isSettingKey('cv')).toBe(true)
    expect(isSettingKey('instagram')).toBe(true)
    expect(isSettingKey('inconnu')).toBe(false)
    expect(isSettingKey('')).toBe(false)
    expect(isSettingKey(42)).toBe(false)
    expect(isSettingKey(null)).toBe(false)
    expect(isSettingKey(undefined)).toBe(false)
    expect(isSettingKey({ cv: true })).toBe(false)
  })

  it('does not take a property of Object for a setting', () => {
    // `in` walks the prototype chain: without care, 'toString' would pass.
    expect(isSettingKey('toString')).toBe(false)
    expect(isSettingKey('constructor')).toBe(false)
  })

  it('lists exactly the keys that have a schema', () => {
    expect(SETTING_KEYS).toEqual(Object.keys(SETTING_SCHEMAS))
    expect(SETTING_KEYS.every(isSettingKey)).toBe(true)
  })

  it('gives every key a scope and a default', () => {
    // A key missing from SETTING_SCOPE would default to undefined, i.e. to
    // neither public nor technical — the ambiguity a filter must never meet.
    for (const key of SETTING_KEYS) {
      expect(['public', 'tech']).toContain(SETTING_SCOPE[key])
      expect(SETTING_DEFAULTS[key]).toBeDefined()
    }
  })

  it('keeps Instagram and storage out of the public scope', () => {
    // These two carry an account's technical configuration.
    expect(SETTING_SCOPE.instagram).toBe('tech')
    expect(SETTING_SCOPE.storage).toBe('tech')
  })
})

describe('setting defaults', () => {
  it('re-parses cleanly through its own schema', () => {
    // A site whose settings have never been filled in must still render: the
    // defaults are what it falls back on, so they must be valid.
    for (const key of SETTING_KEYS) {
      expect(() => SETTING_SCHEMAS[key].parse(SETTING_DEFAULTS[key])).not.toThrow()
    }
  })
})

describe('contact fields', () => {
  it('hides a field until it is explicitly shown', () => {
    // A phone number pasted into the back office must not appear on the site
    // for want of a checkbox: the default is not to publish.
    const parsed = contactSchema.parse({
      fields: [{ key: 'tel', label: 'Téléphone', value: '06 00 00 00 00' }],
    })
    expect(parsed.fields[0]?.visible).toBe(false)
    expect(parsed.fields[0]?.sensitive).toBe(false)
  })

  it('starts with no field at all', () => {
    expect(contactSchema.parse({}).fields).toEqual([])
  })
})

describe('instagram settings', () => {
  it('refuses a sync interval that would hammer the Meta API', () => {
    expect(() => instagramSchema.parse({ syncIntervalMinutes: 1 })).toThrow()
    expect(() => instagramSchema.parse({ syncIntervalMinutes: 4.5 })).toThrow()
    expect(instagramSchema.parse({ syncIntervalMinutes: 5 }).syncIntervalMinutes).toBe(5)
  })

  it('defaults to an hour, never synced', () => {
    expect(instagramSchema.parse({})).toEqual({ syncIntervalMinutes: 60, lastSyncAt: null })
  })
})
