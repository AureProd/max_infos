import { describe, expect, it } from 'vitest'
import { sessionHeaders } from '~/composables/useApi'

describe('sessionHeaders', () => {
  it('sends nothing from the browser, where the cookie travels on its own', () => {
    // The server branch is UNREACHABLE here: Vite replaces import.meta.server
    // at compile time, so the jsdom build does not even contain it. What it
    // guards — a $fetch from a setup answering 401 without the cookie — is
    // proved by the api suite instead, against a real server.
    expect(sessionHeaders()).toEqual({})
  })
})
