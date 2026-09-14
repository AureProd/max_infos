import { describe, expect, it } from 'vitest'
import { useFilters } from '~/composables/useFilters'

/**
 * Le filtrage se fait désormais en SQL : ces tests portent donc sur l'ÉTAT
 * et son isolation, pas sur le résultat du filtre, qui est couvert par les
 * tests d'API contre une vraie base.
 */
describe('useFilters', () => {
  it('part d’un état vide', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    expect(state.value).toEqual({ q: '', tag: null })
    expect(isActive.value).toBe(false)
  })

  it('bascule un sujet dans les deux sens avec le même appel', () => {
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
    // Comportement voulu : les filtres survivent à la navigation. Ce qui ne
    // doit PAS survivre, c'est le passage d'un visiteur à l'autre — d'où
    // useState plutôt qu'un état au niveau du module.
    const a = useFilters()
    const b = useFilters()
    a.reset()
    a.toggleTag('memoire')
    expect(b.state.value.tag).toBe('memoire')
    a.reset()
  })
})
