import { describe, expect, it } from 'vitest'
import { day, iso } from '../../server/utils/serialize'

describe('date serialisation', () => {
  it('returns a full date as ISO', () => {
    expect(iso(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14T08:30:00.000Z')
  })

  it('returns the day only, without time or zone', () => {
    // That is what frDate() expects, and what the datetime attribute requires.
    expect(day(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14')
  })

  it("lets null through without turning it into today's date", () => {
    expect(iso(null)).toBeNull()
    expect(day(undefined)).toBeNull()
  })
})
