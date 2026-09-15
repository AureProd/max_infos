import { describe, expect, it } from 'vitest'
import { isAllowed, isRole, ROLES } from '#shared/utils/roles'

describe('rôles', () => {
  it('tech peut tout ce que peut editor', () => {
    expect(isAllowed('tech', 'editor')).toBe(true)
    expect(isAllowed('tech', 'tech')).toBe(true)
  })

  it('editor ne peut PAS ce que peut tech', () => {
    // C'est l'invariant central du projet : Max ne doit jamais voir un
    // field technique.
    expect(isAllowed('editor', 'tech')).toBe(false)
  })

  it('editor peut ce que peut editor', () => {
    expect(isAllowed('editor', 'editor')).toBe(true)
  })

  it('l’absence de rôle n’autorise rien', () => {
    // Une session expirée, un account désactivé, un call anonyme : le
    // défaut doit être le refus, jamais la permission.
    for (const required of ROLES) {
      expect(isAllowed(null, required)).toBe(false)
      expect(isAllowed(undefined, required)).toBe(false)
    }
  })

  it('reconnaît les rôles valides et rejette les autres', () => {
    expect(isRole('tech')).toBe(true)
    expect(isRole('editor')).toBe(true)
    for (const falsy of ['admin', 'root', 'TECH', '', null, undefined, 0]) {
      expect(isRole(falsy)).toBe(false)
    }
  })

  it('n’a que deux rôles — en ajouter un doit casser ce test', () => {
    // Un rôle ajouté sans réfléchir à sa place dans la hiérarchie serait
    // silencieusement placé par ROLES.indexOf. Mieux vaut être averti.
    expect([...ROLES]).toEqual(['editor', 'tech'])
  })
})
