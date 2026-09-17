import { describe, expect, it } from 'vitest'
import { addTagLabel, normalizeTagLabel, toggleTag } from '../../shared/utils/tags'

/**
 * Tagging an article used to be a free-text field split on commas. Three
 * consequences, all met: a comma inside a label cut it in two, « Histoire »
 * and « histoire » became two tags, and the same list lived in three places
 * at once — the input, the draft, and a watcher rewriting the input.
 *
 * The rule that replaces it: a label is picked from those that exist, and a
 * new one only ever counts as new if it matches none of them.
 */
describe('normalising a label', () => {
  it('trims and collapses the spacing', () => {
    expect(normalizeTagLabel('  Guerre   froide  ')).toBe('Guerre froide')
  })

  it('keeps a comma, which is now a character like any other', () => {
    expect(normalizeTagLabel('Rennes, ville et histoire')).toBe('Rennes, ville et histoire')
  })
})

describe('adding a label', () => {
  const known = ['Histoire', 'Géopolitique']

  it('reuses the existing spelling rather than creating a twin', () => {
    // « histoire » typed in a hurry must not become a second tag.
    expect(addTagLabel([], known, 'histoire')).toEqual(['Histoire'])
  })

  it('ignores the accents, which is where the twins came from', () => {
    expect(addTagLabel([], known, 'geopolitique')).toEqual(['Géopolitique'])
  })

  it('accepts a genuinely new subject', () => {
    expect(addTagLabel([], known, 'Mémoire')).toEqual(['Mémoire'])
  })

  it('does not add what is already selected', () => {
    expect(addTagLabel(['Histoire'], known, 'HISTOIRE')).toEqual(['Histoire'])
  })

  it('refuses a blank', () => {
    expect(addTagLabel(['Histoire'], known, '   ')).toEqual(['Histoire'])
  })
})

describe('toggling a label', () => {
  it('removes what was selected, and adds what was not', () => {
    expect(toggleTag(['Histoire', 'Mémoire'], 'Histoire')).toEqual(['Mémoire'])
    expect(toggleTag(['Mémoire'], 'Histoire')).toEqual(['Mémoire', 'Histoire'])
  })

  it('leaves the order of the others alone', () => {
    expect(toggleTag(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
})
