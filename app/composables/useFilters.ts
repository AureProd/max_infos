import type { ListeArticlesQuery } from '#shared/schemas/api'

export interface EtatFiltres {
  q: string
  tag: string | null
}

/**
 * Filtrage de la liste d'articles : recherche libre et sujet.
 *
 * Le filtrage se fait désormais EN SQL, côté serveur : le navigateur ne
 * télécharge plus tous les articles pour en cacher la plupart. C'est le
 * gain direct du passage en base.
 *
 * `useState` et NON un état au niveau du module : ce dernier serait
 * instancié une seule fois par processus Node, et la recherche d'un
 * visiteur apparaîtrait chez le suivant.
 */
export function useFilters() {
  const state = useState<EtatFiltres>('filtres', () => ({ q: '', tag: null }))

  const query = computed<Partial<ListeArticlesQuery>>(() => ({
    ...(state.value.q ? { q: state.value.q } : {}),
    ...(state.value.tag ? { tag: state.value.tag } : {}),
  }))

  const { data: tags } = useFetch('/api/tags', { key: 'tags' })

  const { data, status } = useFetch('/api/articles', {
    key: 'articles-filtres',
    query,
    // Le serveur ne rend que la liste non filtrée ; les filtres sont une
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
