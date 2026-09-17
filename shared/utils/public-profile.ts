import type { SettingValue } from '#shared/schemas/settings'

type Contact = SettingValue<'contact'>
type Cv = SettingValue<'cv'>

/**
 * What the public API is allowed to hand out.
 *
 * Every switch of the « À propos » screen was applied IN THE BROWSER: the
 * hidden fields were removed from the screen after having been served. A
 * phone number marked hidden still travelled in /api/site, readable by
 * anyone opening the payload — and indexable.
 *
 * So the cut is made here, before the answer leaves. The page may keep its
 * own filter or not; it no longer decides anything.
 */
export function publicContact(contact: Contact): Contact {
  return { fields: contact.fields.filter((f) => f.visible) }
}

export function publicCv(cv: Cv): Cv {
  const section = (s: Cv['education']): Cv['education'] =>
    s.visible
      ? { visible: true, entries: s.entries.filter((e) => e.visible) }
      : { visible: false, entries: [] }

  return {
    ...cv,
    education: section(cv.education),
    experience: section(cv.experience),
    engagements: section(cv.engagements),
  }
}
