import type { ListArticlesQuery } from '#shared/schemas/api'

export interface FiltersState {
  q: string
  tag: string | null
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
  const state = useState<FiltersState>('filtres', () => ({ q: '', tag: null }))

  const query = computed<Partial<ListArticlesQuery>>(() => ({
    ...(state.value.q ? { q: state.value.q } : {}),
    ...(state.value.tag ? { tag: state.value.tag } : {}),
  }))

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
    tags: computed(() => tags.value ?? []),
    articles: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    enCours: computed(() => status.value === 'pending'),
    isActive: computed(() => Boolean(state.value.q || state.value.tag)),
    toggleTag: (slug: string): void => {
      state.value.tag = state.value.tag === slug ? null : slug
    },
    reset: (): void => {
      state.value.q = ''
      state.value.tag = null
    },
  }
}
