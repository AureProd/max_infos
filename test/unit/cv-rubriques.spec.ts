import { describe, expect, it } from 'vitest'
import { cvSchema } from '../../shared/schemas/settings'
import { CV_LISTS, CV_SECTIONS, cleanCvLists } from '../../shared/utils/cv'

/**
 * Every rubric the public page renders must be one Max can type.
 *
 * The page rendered `skills`, `languages`, `certifications` and `interests`
 * while no admin screen ever wrote them: the compétences seen in dev came
 * from the seed alone, and production served an empty list forever. The
 * two screens diverged because each held its OWN list of rubrics.
 *
 * Hence this test, which reads the SCHEMA rather than the screens: adding a
 * rubric without giving it a place fails here, before anyone notices on the
 * site.
 */

/** What the schema holds, classified by what an empty CV defaults to. */
const empty = cvSchema.parse({})

// `'entries' in v` alone would catch the arrays too: Array.prototype has
// an `entries` method. Hence the array check FIRST.
const dated = Object.entries(empty)
  .filter(([, v]) => !Array.isArray(v) && typeof v === 'object' && v !== null && 'entries' in v)
  .map(([k]) => k)

const listed = Object.entries(empty)
  .filter(([, v]) => Array.isArray(v))
  .map(([k]) => k)

describe('the rubrics of the CV', () => {
  it('cover every dated section of the schema', () => {
    expect(CV_SECTIONS.map((s) => s.key).sort()).toEqual(dated.sort())
  })

  // `skills` is apart: its group labels are typed by Max, not fixed here.
  it('cover every list of the schema, skills apart', () => {
    expect([...CV_LISTS.map((l) => l.key), 'skills'].sort()).toEqual(listed.sort())
  })

  it('never claim the same key twice', () => {
    const keys = [...CV_SECTIONS.map((s) => s.key), ...CV_LISTS.map((l) => l.key)]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('name each rubric for the reader', () => {
    for (const r of [...CV_SECTIONS, ...CV_LISTS]) expect(r.label.trim()).not.toBe('')
  })
})

/**
 * A blank row must never cost the whole setting.
 *
 * The identity, the contacts and the CV are saved in the same breath: one
 * refused key takes the other two with it. `level` is the sharpest edge —
 * the schema types it `string | null`, and an empty input yields `''`.
 */
describe('cleaning before saving', () => {
  it('drops a group without a name, and an empty item', () => {
    const cleaned = cleanCvLists({
      skills: [
        { group: '  ', items: ['Enquête'] },
        { group: 'Journalisme', items: ['Enquête', '  ', ''] },
      ],
      languages: [],
      certifications: [],
      interests: [],
    })
    expect(cleaned.skills).toEqual([{ group: 'Journalisme', items: ['Enquête'] }])
  })

  it('drops a group left entirely empty', () => {
    const cleaned = cleanCvLists({
      skills: [{ group: 'Domaines', items: [] }],
      languages: [],
      certifications: [],
      interests: [],
    })
    expect(cleaned.skills).toEqual([])
  })

  it('turns a blank level into null, never an empty string', () => {
    const cleaned = cleanCvLists({
      skills: [],
      languages: [
        { label: 'Anglais', level: '  ' },
        { label: '  ', level: 'C1' },
      ],
      certifications: [],
      interests: [],
    })
    expect(cleaned.languages).toEqual([{ label: 'Anglais', level: null }])
  })

  it('drops blank strings from the plain lists', () => {
    const cleaned = cleanCvLists({
      skills: [],
      languages: [],
      certifications: ['  ', 'Voltaire'],
      interests: ['', 'Randonnée'],
    })
    expect(cleaned.certifications).toEqual(['Voltaire'])
    expect(cleaned.interests).toEqual(['Randonnée'])
  })

  it('leaves what it cleaned acceptable to the schema', () => {
    const cleaned = cleanCvLists({
      skills: [{ group: 'Diffusion', items: ['Newsletter'] }],
      languages: [{ label: 'Anglais', level: '' }],
      certifications: [],
      interests: [],
    })
    expect(() => cvSchema.parse(cleaned)).not.toThrow()
  })
})
