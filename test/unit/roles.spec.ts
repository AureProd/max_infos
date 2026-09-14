import { describe, expect, it } from 'vitest'
import { aLeDroit, estRole, ROLES } from '#shared/utils/roles'

describe('rôles', () => {
  it('tech peut tout ce que peut editor', () => {
    expect(aLeDroit('tech', 'editor')).toBe(true)
    expect(aLeDroit('tech', 'tech')).toBe(true)
  })

  it('editor ne peut PAS ce que peut tech', () => {
    // C'est l'invariant central du projet : Max ne doit jamais voir un
    // champ technique.
    expect(aLeDroit('editor', 'tech')).toBe(false)
  })

  it('editor peut ce que peut editor', () => {
    expect(aLeDroit('editor', 'editor')).toBe(true)
  })

  it('l’absence de rôle n’autorise rien', () => {
    // Une session expirée, un compte désactivé, un appel anonyme : le
    // défaut doit être le refus, jamais la permission.
    for (const requis of ROLES) {
      expect(aLeDroit(null, requis)).toBe(false)
      expect(aLeDroit(undefined, requis)).toBe(false)
    }
  })

  it('reconnaît les rôles valides et rejette les autres', () => {
    expect(estRole('tech')).toBe(true)
    expect(estRole('editor')).toBe(true)
    for (const faux of ['admin', 'root', 'TECH', '', null, undefined, 0]) {
      expect(estRole(faux)).toBe(false)
    }
  })

  it('n’a que deux rôles — en ajouter un doit casser ce test', () => {
    // Un rôle ajouté sans réfléchir à sa place dans la hiérarchie serait
    // silencieusement placé par ROLES.indexOf. Mieux vaut être averti.
    expect([...ROLES]).toEqual(['editor', 'tech'])
  })
})
