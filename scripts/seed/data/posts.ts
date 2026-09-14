import type { InstagramPost, LinkedinPost, Post } from '../../../shared/types/content'

/**
 * Déclinaisons courtes d'un article long.
 *
 * Instagram et LinkedIn exigent tous deux une authentification : leurs
 * contenus ne peuvent pas être récupérés automatiquement. Les entrées
 * ci-dessous sont donc des EMPLACEMENTS À REMPLIR — remplace `text` et
 * `caption` par tes vraies publications, et `image` par le visuel.
 * L'interface affiche un repère tant que `placeholder` vaut true.
 */
export const POSTS: Post[] = [
  {
    id: 'ig-1',
    network: 'instagram',
    articleId: 'controler-lia',
    date: '2026-09-11',
    caption: 'Visuel de la publication Instagram sur la souveraineté numérique européenne.',
    seed: 11,
    likes: null,
    comments: null,
    placeholder: true,
  },
  {
    id: 'ig-2',
    network: 'instagram',
    articleId: 'fifa',
    date: '2026-09-08',
    caption: 'Visuel de la publication Instagram sur la présidence Infantino à la FIFA.',
    seed: 24,
    likes: null,
    comments: null,
    placeholder: true,
  },
  {
    id: 'li-1',
    network: 'linkedin',
    articleId: 'controler-lia',
    date: '2026-09-11',
    text: "Version condensée de l'article, telle que publiée sur LinkedIn. Colle ici le texte réel du post.",
    placeholder: true,
  },
  {
    id: 'li-2',
    network: 'linkedin',
    articleId: 'fifa',
    date: '2026-09-08',
    text: "Version condensée de l'article, telle que publiée sur LinkedIn. Colle ici le texte réel du post.",
    placeholder: true,
  },
  {
    id: 'li-3',
    network: 'linkedin',
    articleId: 'ni-dici-ni-dailleurs',
    date: '2026-09-02',
    text: "Version condensée de l'article, telle que publiée sur LinkedIn. Colle ici le texte réel du post.",
    placeholder: true,
  },
]

export const IG_POSTS = POSTS.filter((p): p is InstagramPost => p.network === 'instagram')
export const LI_POSTS = POSTS.filter((p): p is LinkedinPost => p.network === 'linkedin')
