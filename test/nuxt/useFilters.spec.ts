import { describe, expect, it } from 'vitest'
import { useFilters } from '~/composables/useFilters'

describe('useFilters', () => {
  it('ne filtre rien par défaut', () => {
    const { articles, isActive } = useFilters()
    expect(isActive.value).toBe(false)
    expect(articles.value.length).toBeGreaterThan(0)
  })

  it('filtre sur le sujet, et le même appel bascule dans les deux sens', () => {
    const { toggleTag, state, articles, reset } = useFilters()
    reset()
    toggleTag('géopolitique')
    expect(state.value.tag).toBe('géopolitique')
    expect(articles.value.every((a) => a.tags.includes('géopolitique'))).toBe(true)
    toggleTag('géopolitique')
    expect(state.value.tag).toBeNull()
    reset()
  })

  it('cherche dans le titre, le chapô et le corps', () => {
    const { state, articles, reset } = useFilters()
    reset()
    state.value.q = 'zzz-introuvable-zzz'
    expect(articles.value).toHaveLength(0)
    state.value.q = 'IA'
    expect(articles.value.length).toBeGreaterThan(0)
    reset()
  })

  it('partage l’état entre deux appels du même contexte', () => {
    // C'est le comportement attendu : les filtres survivent à la
    // navigation. Ce qui ne doit PAS survivre, c'est le passage d'un
    // visiteur à l'autre — d'où useState plutôt qu'un état de module.
    const a = useFilters()
    const b = useFilters()
    a.reset()
    a.toggleTag('mémoire')
    expect(b.state.value.tag).toBe('mémoire')
    a.reset()
  })
})
