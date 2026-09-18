import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { useFilters } from '~/composables/useFilters'

// Fixed from the start: useFetch caches on its key, and the very first call
// — made by the state tests below — is the one that fills that cache.
const tagRows = [{ slug: 'geo', label: 'Géographie' }]
const articleRows = { items: [{ slug: 'a' }, { slug: 'b' }], total: 7 }

registerEndpoint('/api/tags', () => tagRows)
registerEndpoint('/api/articles', () => articleRows)

/**
 * Filtering now happens in SQL: these tests are therefore about the STATE
 * and its isolation, not about the filter's result, which is covered by the
 * API tests against a real database.
 */
describe('useFilters', () => {
  it('starts from an empty state', () => {
    const { state, isActive, reset } = useFilters()
    reset()
    expect(state.value).toEqual({ q: '', tag: null, page: 1 })
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

describe('what useFilters hands the page', () => {
  it('falls back on empty before the answer, then hands over the data', async () => {
    // Both sides of the same `??`, in one test on purpose: useFetch caches
    // on its key, so a second call would not refetch and the fallback would
    // never be seen again.
    const { tags, articles, total, enCours } = useFilters()

    // These getters feed a v-for and a counter: undefined would render
    // « undefined article » and break the loop.
    expect(tags.value).toEqual([])
    expect(articles.value).toEqual([])
    expect(total.value).toBe(0)
    expect(typeof enCours.value).toBe('boolean')

    await new Promise((r) => setTimeout(r, 100))

    expect(tags.value).toHaveLength(1)
    expect(articles.value).toHaveLength(2)
    // The total is the SERVER's, not the page's: filtering happens in SQL,
    // so the list is a page and the count is the whole set.
    expect(total.value).toBe(7)
  })
})

/**
 * Ce que le tag doit ARRIVER À FAIRE : entrer dans la requête.
 *
 * Les tests ci-dessus décrivent l'état ; aucun ne disait que cet état
 * atteint le serveur. Un tag qui se coche sans changer la requête est
 * exactement ce que l'on voit quand « les tags ne filtrent pas » : la
 * pastille s'allume, et la liste ne bouge pas.
 */
describe('la requête envoyée au serveur', () => {
  it('porte le tag choisi, et le retire au second clic', async () => {
    const { toggleTag, reset, query } = useFilters()
    reset()
    expect(query.value.tag).toBeUndefined()

    toggleTag('geopolitique')
    await nextTick()
    expect(query.value.tag).toBe('geopolitique')

    toggleTag('geopolitique')
    await nextTick()
    expect(query.value.tag).toBeUndefined()
    reset()
  })

  it('revient à la première page quand le tag change', async () => {
    // Autrement, un filtre posé depuis la page 3 répondait par la troisième
    // page de SES résultats — le plus souvent vide, lue comme « rien ne
    // correspond ».
    const { toggleTag, goTo, state, reset, query } = useFilters()
    reset()
    goTo(3)
    expect(state.value.page).toBe(3)

    toggleTag('europe')
    await nextTick()
    expect(state.value.page).toBe(1)
    expect(query.value.page).toBe(1)
    reset()
  })

  it('cumule le tag et la recherche plutôt que de les remplacer', async () => {
    const { toggleTag, state, reset, query } = useFilters()
    reset()
    toggleTag('europe')
    state.value.q = 'souveraineté'
    // Le texte est temporisé de 300 ms ; le tag, lui, part tout de suite.
    await new Promise((r) => setTimeout(r, 400))
    expect(query.value.tag).toBe('europe')
    expect(query.value.q).toBe('souveraineté')
    reset()
  })
})
