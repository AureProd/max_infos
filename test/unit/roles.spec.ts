import { describe, expect, it } from 'vitest'
import { asRole, isAllowed, isRole, LEGACY_ROLE, ROLES, STORED_ROLES } from '#shared/utils/roles'

describe('roles', () => {
  it('developer can do everything editor can', () => {
    expect(isAllowed('developer', 'editor')).toBe(true)
    expect(isAllowed('developer', 'developer')).toBe(true)
  })

  it('editor CANNOT do what developer can', () => {
    // C'est l'invariant central du projet : Max ne doit jamais voir un
    // field technique.
    expect(isAllowed('editor', 'developer')).toBe(false)
  })

  it('editor can do what editor can', () => {
    expect(isAllowed('editor', 'editor')).toBe(true)
  })

  it('the absence of a role allows nothing', () => {
    // An expired session, a disabled account, an anonymous call: the
    // default must be refusal, never permission.
    for (const required of ROLES) {
      expect(isAllowed(null, required)).toBe(false)
      expect(isAllowed(undefined, required)).toBe(false)
    }
  })

  it('recognises the valid roles and rejects the others', () => {
    expect(isRole('developer')).toBe(true)
    expect(isRole('editor')).toBe(true)
    for (const falsy of ['admin', 'root', 'DEVELOPER', '', null, undefined, 0]) {
      expect(isRole(falsy)).toBe(false)
    }
  })

  it('has only two roles — adding one must break this test', () => {
    // A role added without thinking about its place in the hierarchy would
    // be silently positioned by ROLES.indexOf. Better to be warned.
    expect([...ROLES]).toEqual(['editor', 'developer'])
  })
})

/**
 * `tech` was the former name of `developer`.
 *
 * A migration renames the rows, but not in the same instant as the
 * deployment: the OLD container keeps running while the new schema is
 * applied, and it writes `tech`. A row carrying the old name must therefore
 * still be understood — and, crucially, must still be ALLOWED, or JB locks
 * himself out of his own back-office for the length of a deployment.
 */
describe('the former name of the developer role', () => {
  it('is still accepted by the CHECK constraint, for one deployment', () => {
    expect([...STORED_ROLES].sort()).toEqual(['developer', 'editor', 'tech'])
  })

  it('reads as `developer`, so nothing downstream has to know', () => {
    expect(asRole(LEGACY_ROLE)).toBe('developer')
    expect(asRole('editor')).toBe('editor')
    expect(asRole('developer')).toBe('developer')
  })

  it('grants what `developer` grants, never less', () => {
    expect(isAllowed(asRole('tech'), 'developer')).toBe(true)
  })

  it('falls back to the least powerful role when the value is unknown', () => {
    // A row written by hand, or a value from a future version rolled back:
    // the default must be refusal, not permission.
    expect(asRole('root')).toBe('editor')
    expect(asRole(null)).toBe('editor')
  })
})
