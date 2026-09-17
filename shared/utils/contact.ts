import type { SettingValue } from '#shared/schemas/settings'

type ContactField = SettingValue<'contact'>['fields'][number]

/**
 * The key of a contact field: an identity, not a label.
 *
 * It is never shown and never typed — the admin screen offers no input for
 * it. Leaving it to Max meant leaving it EMPTY, and the schema refuses an
 * empty key: the whole `contact` setting was rejected, so « À propos »
 * saved neither the contacts nor the CV alongside them.
 *
 * Derived from the label when there is one, so that a hand-read of the
 * database stays legible, and suffixed as soon as it would collide.
 */
function keyFor(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'contact'
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** A blank field, HIDDEN: a contact must never become public by accident. */
export function newContactField(existing: readonly { key: string }[]): ContactField {
  return {
    key: keyFor('contact', new Set(existing.map((f) => f.key))),
    label: '',
    value: '',
    visible: false,
    sensitive: false,
  }
}

/**
 * What is actually sent when Max saves.
 *
 * Two repairs, and the screen is unusable without either one. Blank rows go
 * — clicking « + Ajouter » then saving had the schema refuse the ENTIRE
 * setting, the CV of the same screen included. And the fields saved before
 * the fix get their key back, so Max does not have to retype his contacts.
 */
export function cleanContactFields<T extends { key: string; label: string; value: string }>(
  fields: readonly T[],
): T[] {
  const kept = fields.filter((f) => f.label.trim() !== '' || f.value.trim() !== '')
  const taken = new Set<string>()
  return kept.map((field) => {
    const key = field.key.trim() === '' ? keyFor(field.label, taken) : field.key
    taken.add(key)
    return { ...field, key }
  })
}
