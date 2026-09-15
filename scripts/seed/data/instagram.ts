import type { IgMedia } from '../../../shared/types/content'

/**
 * Intégration Instagram.
 *
 * Instagram n'expose plus aucune publication sans authentification :
 * l'API Basic Display a fermé fin 2024 et l'API Graph exige un account
 * professionnel, une application Meta et un token à renouveler.
 *
 * La voie qui fonctionne sans token est l'EMBED OFFICIEL : la publication
 * est rendue par Instagram dans une iframe, avec son média, sa légende et
 * ses flèches de carrousel d'origine. Le content est monté en JavaScript
 * côté navigateur — il ne se voit donc pas en récupérant l'URL en ligne
 * de commande, seulement dans une vraie page.
 *
 * Pour add une publication : copied son adresse since Instagram et
 * reporte l'identifiant qui suit /p/ ou /reel/ dans `shortcode`.
 */
export const IG_MEDIA: IgMedia[] = [
  {
    id: 'ig-1',
    type: 'reel',
    kind: 'p',
    shortcode: 'DdGUF5XJbhE',
    url: 'https://www.instagram.com/p/DdGUF5XJbhE/',
    articleId: 'cri-dequoy',
    date: '2026-09-11',
  },
  {
    id: 'ig-2',
    type: 'reel',
    kind: 'p',
    shortcode: 'DdCLb6pzJVt',
    url: 'https://www.instagram.com/p/DdCLb6pzJVt/',
    articleId: 'ni-dici-ni-dailleurs',
    date: '2026-09-08',
  },
]

export const findMedia = (id: string): IgMedia | undefined => IG_MEDIA.find((m) => m.id === id)
