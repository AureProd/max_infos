import { reactive, computed } from 'vue'
import { ARTICLES } from '@/data/content'

/**
 * État de filtrage partagé, conservé au niveau du module : la recherche
 * et le sujet sélectionné survivent à la navigation.
 */
const state = reactive({ q: '', tag: null })

function matches(article) {
  if (state.tag && !article.tags.includes(state.tag)) return false
  if (!state.q) return true
  const q = state.q.toLowerCase()
  return [article.title, article.dek, article.body, article.tags.join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function useFilters() {
  return {
    state,
    toggleTag: (tag) => {
      state.tag = state.tag === tag ? null : tag
    },
    reset: () => {
      state.q = ''
      state.tag = null
    },
    isActive: computed(() => Boolean(state.q || state.tag)),
    articles: computed(() => ARTICLES.filter(matches))
  }
}
