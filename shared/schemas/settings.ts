import { z } from 'zod'

/**
 * Everything Max can change without writing code.
 *
 * The schema is indexed BY KEY, which buys two things at once:
 * `getSetting('cv').education[0].org` is typed, and the public/technical
 * scope is TypeScript data — so the tests can enumerate it, instead of it
 * being copied by hand somewhere.
 */

const entry = z.object({
  title: z.string().trim().max(300),
  org: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(600).optional(),
  start: z.string().trim().max(20).optional(),
  end: z.string().trim().max(20).optional(),
  url: z.string().trim().url().max(600).optional(),
  visible: z.boolean().default(true),
})

const section = z.object({
  visible: z.boolean().default(true),
  entries: z.array(entry).max(50).default([]),
})

export const identitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  author: z.string().trim().min(1).max(120),
  byline: z.string().trim().max(120),
  tagline: z.string().trim().max(400),
  pitch: z.string().trim().max(1200),
})

/**
 * Every contact field carries ITS OWN switch.
 *
 * The CV holds personal data that has no place on an indexed public page.
 * Default setting: phone, address and date of birth hidden. The admin warns
 * explicitly when one of them is about to be made visible.
 */
export const contactSchema = z.object({
  fields: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60),
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().max(600),
        href: z.string().trim().max(600).optional(),
        visible: z.boolean().default(false),
        /** Flags a field whose publication deserves a second thought. */
        sensitive: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
})

export const cvSchema = z.object({
  headline: z.string().trim().max(300).default(''),
  intro: z.string().trim().max(2000).default(''),
  photoMediaId: z.number().int().positive().nullable().default(null),
  pdfMediaId: z.number().int().positive().nullable().default(null),
  education: section.default({ visible: true, entries: [] }),
  experience: section.default({ visible: true, entries: [] }),
  engagements: section.default({ visible: true, entries: [] }),
  skills: z
    .array(z.object({ group: z.string(), items: z.array(z.string()) }))
    .max(20)
    .default([]),
  interests: z.array(z.string().max(200)).max(40).default([]),
  languages: z
    .array(z.object({ label: z.string().max(80), level: z.string().max(20).nullable() }))
    .max(20)
    .default([]),
  certifications: z.array(z.string().max(200)).max(20).default([]),
})

export const homeSchema = z.object({
  sections: z.array(z.string().max(40)).max(20).default([]),
  featured: z.array(z.string().max(200)).max(10).default([]),
})

export const themeSchema = z.object({
  /** The CSS variables of base.css, overridden at runtime. */
  variables: z.record(z.string().max(60), z.string().max(200)).default({}),
})

export const seoSchema = z.object({
  title: z.string().trim().max(300).default(''),
  description: z.string().trim().max(600).default(''),
  imageMediaId: z.number().int().positive().nullable().default(null),
})

export const templatesSchema = z.object({
  linkedin: z.string().max(8000),
  reel: z.string().max(8000),
})

/**
 * TECHNICAL Instagram settings: never returned by /api/site.
 *
 * The public profile has left the settings: it lives in `social_account`,
 * one row per account, fed by the sync. A single setting could only ever
 * describe a single account.
 */
export const instagramSchema = z.object({
  syncIntervalMinutes: z.number().int().min(5).default(60),
  lastSyncAt: z.string().nullable().default(null),
})

export const storageSchema = z.object({
  bucket: z.string().max(200).default(''),
  publicBaseUrl: z.string().max(600).default(''),
})

export const SETTING_SCHEMAS = {
  identity: identitySchema,
  contact: contactSchema,
  cv: cvSchema,
  home: homeSchema,
  theme: themeSchema,
  seo: seoSchema,
  templates: templatesSchema,
  instagram: instagramSchema,
  storage: storageSchema,
} as const

export type SettingKey = keyof typeof SETTING_SCHEMAS
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>

/**
 * The scope of each setting. This is the border between what Max changes
 * and what only JB sees — and it is DATA, which the authorization test
 * enumerates instead of copying.
 */
export const SETTING_SCOPE: Record<SettingKey, 'public' | 'tech'> = {
  identity: 'public',
  contact: 'public',
  cv: 'public',
  home: 'public',
  theme: 'public',
  seo: 'public',
  templates: 'public',
  instagram: 'tech',
  storage: 'tech',
}

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[]

/**
 * The starting value of each setting.
 *
 * Explicit rather than derived from a `parse({})`: `identity` and
 * `templates` have required fields, and a fallback that throws is worse
 * than no fallback — it turns an unset setting into a 500 error.
 *
 * Used twice: at startup on a blank database, and as a net when a stored
 * value no longer matches the schema. A site whose CV is not filled in must
 * still render.
 */
export const SETTING_DEFAULTS: { [K in SettingKey]: SettingValue<K> } = {
  identity: {
    name: "Un Max d'info",
    author: 'Maximilien Huet',
    byline: 'Max',
    tagline: '',
    pitch: '',
  },
  contact: { fields: [] },
  cv: cvSchema.parse({}),
  home: homeSchema.parse({}),
  theme: themeSchema.parse({}),
  seo: seoSchema.parse({}),
  templates: { linkedin: '', reel: '' },
  instagram: instagramSchema.parse({}),
  storage: storageSchema.parse({}),
}

// `hasOwn` rather than `in`: `in` walks the prototype chain, so 'toString'
// and 'constructor' would pass the guard and index SETTING_SCHEMAS onto a
// function instead of a schema.
export const isSettingKey = (v: unknown): v is SettingKey =>
  typeof v === 'string' && Object.hasOwn(SETTING_SCHEMAS, v)
