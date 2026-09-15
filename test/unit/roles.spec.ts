import { describe, expect, it } from 'vitest'
import { isAllowed, isRole, ROLES } from '#shared/utils/roles'

describe('roles', () => {
  it('tech can do everything editor can', () => {
    expect(isAllowed('tech', 'editor')).toBe(true)
    expect(isAllowed('tech', 'tech')).toBe(true)
  })

  it('editor CANNOT do what tech can', () => {
    // C'est l'invariant central du projet : Max ne doit jamais voir un
    // field technique.
    expect(isAllowed('editor', 'tech')).toBe(false)
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
    expect(isRole('tech')).toBe(true)
    expect(isRole('editor')).toBe(true)
    for (const falsy of ['admin', 'root', 'TECH', '', null, undefined, 0]) {
      expect(isRole(falsy)).toBe(false)
    }
  })

  it('has only two roles — adding one must break this test', () => {
    // A role added without thinking about its place in the hierarchy would
    // be silently positioned by ROLES.indexOf. Better to be warned.
    expect([...ROLES]).toEqual(['editor', 'tech'])
  })
})
