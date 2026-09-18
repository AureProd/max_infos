import type { ListArticlesQuery } from '#shared/schemas/api'

export interface FiltersState {
  q: string
  tag: string | null
  page: number
}

/**
 * Filtering the article list: free-text search and tag.
 *
 * Filtering now happens IN SQL, server-side: the browser no longer
 * downloads every article to hide most of them. That is the direct gain of
 * moving to a database.
 *
 * `useState` and NOT module-level state: the latter would be instantiated
 * once per Node process, and one visitor's search would show up for the
 * next.
 */
export function useFilters() {
  const state = useState<FiltersState>('filtres', () => ({ q: '', tag: null, page: 1 }))

  /**
   * The typed text, settled.
   *
   * Without this, every keystroke fired a request: typing « géopolitique »
   * sent thirteen, each scanning the body of every article, and their
   * answers could arrive out of order. Same 300 ms as the draft preview.
   */
  const settledQ = ref(state.value.q)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => state.value.q,
    (value) => {
      clearTimeout(timer)
      // Clearing the field must answer at once: the visitor is waiting for
      // the full list to come back, not for a delay.
      if (!value) {
        settledQ.value = ''
        return
      }
      timer = setTimeout(() => {
        settledQ.value = value
      }, 300)
    },
  )

  const query = computed<Partial<ListArticlesQuery>>(() => ({
    // Trimmed here: a lone space used to travel to the server, fail its
    // `min(1)` validation and come back as a 400 that the page rendered
    // as « Aucun article ne correspond ».
    ...(settledQ.value.trim() ? { q: settledQ.value.trim() } : {}),
    ...(state.value.tag ? { tag: state.value.tag } : {}),
    page: state.value.page,
  }))

  /*
   * Any change of filter goes back to page 1.
   *
   * Otherwise a search made from page 3 answered with the third page of its
   * results — most often an empty one, read as « nothing matches ».
   */

  watch([settledQ, () => state.value.tag], () => {
    state.value.page = 1
  })

  const { data: tags } = useFetch('/api/tags', { key: 'tags' })

  const { data, status } = useFetch('/api/articles', {
    key: 'articles-filtres',
    query,
    // The server only renders the unfiltered list; filters are a visitor
    // action, so the request only leaves from the browser.
    watch: [query],
  })

  return {
    state,
    /*
     * Exposée pour être ÉPROUVÉE.
     *
     * C'est elle qui porte le filtre jusqu'au serveur. Un tag qui se coche
     * sans entrer ici, c'est une pastille qui s'allume et une liste qui ne
     * bouge pas — le défaut que `test/nuxt/useFilters.spec.ts` interdit.
     */
    query,
    tags: computed(() => tags.value ?? []),
    articles: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    enCours: computed(() => status.value === 'pending'),
    isActive: computed(() => Boolean(state.value.q || state.value.tag)),
    page: computed(() => state.value.page),
    /*
     * The page count. The counter announced « 38 résultat(s) » while the
     * list showed twelve, and no control existed to reach the other
     * twenty-six: they were simply unreachable.
     */
    pages: computed(() => {
      const size = data.value?.size ?? 12
      return Math.max(1, Math.ceil((data.value?.total ?? 0) / size))
    }),
    goTo: (page: number): void => {
      state.value.page = Math.max(1, page)
      if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    toggleTag: (slug: string): void => {
      state.value.tag = state.value.tag === slug ? null : slug
    },
    reset: (): void => {
      state.value.q = ''
      state.value.tag = null
      state.value.page = 1
    },
  }
}
