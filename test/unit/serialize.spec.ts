import { describe, expect, it } from 'vitest'
import { iso, jour } from '../../server/utils/serialize'

describe('sérialisation des dates', () => {
  it('rend une date complète en ISO', () => {
    expect(iso(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14T08:30:00.000Z')
  })

  it('rend le jour seul, sans heure ni fuseau', () => {
    // C'est ce que frDate() attend, et ce que réclame l'attribut datetime.
    expect(jour(new Date('2026-09-14T08:30:00Z'))).toBe('2026-09-14')
  })

  it('laisse passer null sans le transformer en date du jour', () => {
    expect(iso(null)).toBeNull()
    expect(jour(undefined)).toBeNull()
  })
})
