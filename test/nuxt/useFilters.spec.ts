import { describe, expect, it } from 'vitest'
import { useFilters } from '~/composables/useFilters'

/**
 * Filtering now happens in SQL: these tests are therefore about the STATE
 * and its isolation, not about the filter's result, which is covered by the
 * API tests against a real database.
 */
describe('useFilters', () => {
  it('starts from an empty state', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    expect(state.value).toEqual({ q: '', tag: null })
    expect(isActive.value).toBe(false)
  })

  it('toggles a tag both ways with the same call', () => {
    const { toggleTag, state, reset } = useFilters()
    reset()
    toggleTag('geopolitique')
    expect(state.value.tag).toBe('geopolitique')
    toggleTag('geopolitique')
    expect(state.value.tag).toBeNull()
    reset()
  })

  it('reports that a filter is active', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    state.value.q = 'ia'
    expect(isActive.value).toBe(true)
    reset()
    expect(isActive.value).toBe(false)
  })

  it('shares the state between two calls in the same context', () => {
    // Intended behaviour: filters survive navigation. What must NOT survive
    // is going from one visitor to the next — hence useState rather than
    // module-level state.
    const a = useFilters()
    const b = useFilters()
    a.reset()
    a.toggleTag('memoire')
    expect(b.state.value.tag).toBe('memoire')
    a.reset()
  })
})
