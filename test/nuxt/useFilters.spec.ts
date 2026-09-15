import { describe, expect, it } from 'vitest'
import { useFilters } from '~/composables/useFilters'

/**
 * Filtering now happens in SQL: these tests are therefore about the STATE
 * and its isolation, not about the filter's result, which is covered by the
 * API tests against a real database.
 */
describe('useFilters', () => {
  it('part d’un état vide', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    expect(state.value).toEqual({ q: '', tag: null })
    expect(isActive.value).toBe(false)
  })

  it('bascule un tag dans les deux sens avec le même appel', () => {
    const { toggleTag, state, reset } = useFilters()
    reset()
    toggleTag('geopolitique')
    expect(state.value.tag).toBe('geopolitique')
    toggleTag('geopolitique')
    expect(state.value.tag).toBeNull()
    reset()
  })

  it('signale qu’un filtre est actif', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    state.value.q = 'ia'
    expect(isActive.value).toBe(true)
    reset()
    expect(isActive.value).toBe(false)
  })

  it('partage l’état entre deux appels du même contexte', () => {
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
