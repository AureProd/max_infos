import { describe, expect, it } from 'vitest'
import { day, iso } from '../../server/utils/serialize'

describe('sérialisation des dates', () => {
  it('rend une date complète en ISO', () => {
    expect(iso(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14T08:30:00.000Z')
  })

  it('rend le jour seul, sans heure ni fuseau', () => {
    // That is what frDate() expects, and what the datetime attribute requires.
    expect(day(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14')
  })

  it('laisse passer null sans le transformer en date du jour', () => {
    expect(iso(null)).toBeNull()
    expect(day(undefined)).toBeNull()
  })
})
