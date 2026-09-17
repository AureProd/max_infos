import { describe, expect, it } from 'vitest'
import { contactSchema } from '../../shared/schemas/settings'
import { cleanContactFields, newContactField } from '../../shared/utils/contact'

/**
 * A contact field carries a `key`, and the schema demands at least one
 * character — as it does for `label`. The admin screen offers no input for
 * the key, and a row is added blank: BOTH made the whole `contact` setting
 * fail validation, so « À propos » saved nothing at all, without a word to
 * Max, who only ever saw a form that would not stick.
 *
 * What follows pins the admin screen to the schema that judges it.
 */
const accepted = (fields: unknown[]): boolean => contactSchema.safeParse({ fields }).success

describe('a newly added contact field', () => {
  it('is hidden, because publishing by accident is the risk', () => {
    expect(newContactField([]).visible).toBe(false)
  })

  it('already carries a key, which no one will ever type', () => {
    expect(newContactField([]).key).not.toBe('')
  })

  it('never repeats a key already in the list', () => {
    const fields = []
    for (let i = 0; i < 5; i++) fields.push(newContactField(fields))
    expect(new Set(fields.map((f) => f.key)).size).toBe(5)
  })
})

describe('what is sent when Max saves', () => {
  it('a filled-in field is accepted by the schema that stores it', () => {
    const fields = cleanContactFields([
      { ...newContactField([]), label: 'E-mail', value: 'max@exemple.fr' },
    ])
    expect(accepted(fields)).toBe(true)
  })

  it('a row left blank is DROPPED, not refused', () => {
    // Clicking « + Ajouter » then saving used to reject the entire
    // setting — the CV of the same screen included.
    const fields = cleanContactFields([
      { ...newContactField([]), label: 'E-mail', value: 'max@exemple.fr' },
      newContactField([]),
    ])
    expect(fields).toHaveLength(1)
    expect(accepted(fields)).toBe(true)
  })

  it('gives a key back to a field saved before the fix', () => {
    const fields = cleanContactFields([
      { key: '', label: 'E-mail', value: 'a@b.fr', visible: true, sensitive: false },
      { key: '', label: 'Instagram', value: '@x', visible: true, sensitive: false },
    ])
    expect(accepted(fields)).toBe(true)
    expect(new Set(fields.map((f) => f.key)).size).toBe(2)
  })

  it('keeps a field that has a label but no value yet', () => {
    // « Téléphone » typed, number still to come: that is work in progress,
    // not a blank row.
    expect(cleanContactFields([{ ...newContactField([]), label: 'Téléphone' }])).toHaveLength(1)
  })
})
