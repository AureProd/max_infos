import { z } from 'zod'

/**
 * Tout ce que Max peut modifier sans coder.
 *
 * Le schéma est indexé PAR CLÉ, ce qui donne deux choses d'un coup :
 * `getSetting('cv').education[0].org` est typé, et la portée
 * publique/technique est une donnée TypeScript — donc énumérable par les
 * tests, au lieu d'être recopiée à la main quelque part.
 */

const entree = z.object({
  title: z.string().trim().max(300),
  org: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(600).optional(),
  start: z.string().trim().max(20).optional(),
  end: z.string().trim().max(20).optional(),
  url: z.string().trim().url().max(600).optional(),
  visible: z.boolean().default(true),
})

const rubrique = z.object({
  visible: z.boolean().default(true),
  entrees: z.array(entree).max(50).default([]),
})

export const identitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  author: z.string().trim().min(1).max(120),
  byline: z.string().trim().max(120),
  tagline: z.string().trim().max(400),
  pitch: z.string().trim().max(1200),
})

/**
 * Chaque champ de contact porte SON PROPRE interrupteur.
 *
 * Le CV comporte des données personnelles qui n'ont rien à faire sur une
 * page publique indexée. Réglage d'origine : téléphone, adresse et date de
 * naissance masqués. L'admin avertit explicitement au moment de rendre
 * l'un d'eux visible.
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
        /** Signale un champ dont la publication mérite réflexion. */
        sensible: z.boolean().default(false),
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
  education: rubrique.default({ visible: true, entrees: [] }),
  experience: rubrique.default({ visible: true, entrees: [] }),
  engagements: rubrique.default({ visible: true, entrees: [] }),
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
  /** Les variables CSS de base.css, surchargées à l'exécution. */
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
 * Réglages TECHNIQUES d'Instagram : jamais renvoyés par /api/site.
 *
 * Le profil public a quitté les réglages : il vit dans `social_account`,
 * une ligne par compte, alimentée par la synchronisation. Un réglage unique
 * ne pouvait décrire qu'un seul compte.
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
 * La portée de chaque réglage. C'est la frontière entre ce que Max règle et
 * ce que seul JB voit — et c'est une DONNÉE, que le test d'autorisations
 * énumère au lieu de la recopier.
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
 * La valeur de départ de chaque réglage.
 *
 * Explicite plutôt que déduite d'un `parse({})` : `identity` et `templates`
 * ont des champs obligatoires, et un repli qui échoue est pire que pas de
 * repli — il transforme un réglage non renseigné en erreur 500.
 *
 * Sert deux fois : au démarrage sur une base vierge, et comme filet quand
 * une valeur stockée ne correspond plus au schéma. Un site dont le CV n'est
 * pas rempli doit s'afficher.
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

export const estCleDeReglage = (v: unknown): v is SettingKey =>
  typeof v === 'string' && v in SETTING_SCHEMAS
