import type { Article } from '#shared/types/content'
import { ALL_TAGS, ARTICLES } from '~/data/content'

export interface EtatFiltres {
  q: string
  tag: string | null
}

/**
 * État de filtrage de la liste d'articles : recherche libre et sujet.
 *
 * `useState` et NON un `reactive` au niveau du module.
 *
 * La version d'origine gardait l'état hors de la fonction, ce qui était un
 * choix défendable en application monopage — les filtres survivaient à la
 * navigation. En rendu serveur, c'est une FUITE ENTRE VISITEURS : le module
 * est instancié une seule fois par processus Node, si bien que la recherche
 * d'un visiteur apparaîtrait chez le suivant. `useState` isole par requête
 * côté serveur et sérialise l'état vers le client, ce qui conserve le
 * comportement voulu sans le défaut.
 */
export function useFilters() {
  const state = useState<EtatFiltres>('filtres', () => ({ q: '', tag: null }))

  const correspond = (article: Article): boolean => {
    if (state.value.tag && !article.tags.includes(state.value.tag)) return false
    if (!state.value.q) return true
    const q = state.value.q.toLowerCase()
    return [article.title, article.dek, article.body, article.tags.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(q)
  }

  return {
    state,
    tags: ALL_TAGS,
    toggleTag: (tag: string): void => {
      state.value.tag = state.value.tag === tag ? null : tag
    },
    reset: (): void => {
      state.value.q = ''
      state.value.tag = null
    },
    isActive: computed(() => Boolean(state.value.q || state.value.tag)),
    articles: computed(() => ARTICLES.filter(correspond)),
  }
}
