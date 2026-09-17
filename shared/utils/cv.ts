import type { SettingValue } from '#shared/schemas/settings'

type Cv = SettingValue<'cv'>

/**
 * The rubrics of the CV, named ONCE for both screens.
 *
 * The public page and the back-office each held their own list, and they
 * drifted: four rubrics were rendered that no screen ever wrote. What is
 * shared here is read by `app/pages/about.vue` and by
 * `app/pages/admin/about.vue` alike, and a test reads the schema to make
 * sure neither forgets one.
 */

/** The dated rubrics: an intitulé, an organisation, a period. */
export const CV_SECTIONS = [
  { key: 'education', label: 'Formations' },
  { key: 'experience', label: 'Expériences' },
  { key: 'engagements', label: 'Engagements' },
] as const satisfies readonly { key: keyof Cv; label: string }[]

/**
 * The plain lists, shown as chips.
 *
 * `skills` is NOT here: its group labels are typed by Max in the
 * back-office, not fixed by the code.
 */
export const CV_LISTS = [
  { key: 'languages', label: 'Langues' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'interests', label: "Centres d'intérêt" },
] as const satisfies readonly { key: keyof Cv; label: string }[]

export type CvSectionKey = (typeof CV_SECTIONS)[number]['key']

type Lists = Pick<Cv, 'skills' | 'languages' | 'certifications' | 'interests'>

const filled = (s: string): boolean => s.trim() !== ''

/**
 * What is actually sent when Max saves the chips.
 *
 * A blank row used to cost the whole `cv` key — and the identity and the
 * contacts with it, since the three are saved in the same breath. The
 * sharpest edge is `level`, typed `string | null`: an untouched input
 * yields `''`, which the schema refuses.
 */
export function cleanCvLists<T extends Lists>(lists: T): T {
  return {
    ...lists,
    skills: lists.skills
      .map((set) => ({ ...set, group: set.group.trim(), items: set.items.filter(filled) }))
      .filter((set) => set.group !== '' && set.items.length > 0),
    languages: lists.languages
      .map((l) => ({ ...l, label: l.label.trim(), level: l.level?.trim() || null }))
      .filter((l) => l.label !== ''),
    certifications: lists.certifications.filter(filled),
    interests: lists.interests.filter(filled),
  }
}
