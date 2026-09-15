import type { ListArticlesQuery } from '#shared/schemas/api'

export interface FiltersState {
  q: string
  tag: string | null
}

/**
 * Filtrage de la list d'articles : recherche libre et tag.
 *
 * Le filtrage se fait désormais EN SQL, côté serveur : le navigateur ne
 * télécharge plus all les articles pour en cacher la plupart. C'est le
 * gain direct du passage en base.
 *
 * `useState` et NON un état au niveau du module : ce last serait
 * instancié une seule fois par processus Node, et la recherche d'un
 * visiteur apparaîtrait chez le next.
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
    // Le serveur ne rend que la list non filtrée ; les filtres sont une
    // action du visiteur, donc la requête ne part qu'au navigateur.
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
