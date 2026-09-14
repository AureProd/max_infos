import type { IgMedia } from '#shared/types/content'
import type { SlideSpec } from '#shared/types/slide'

export interface CarouselPreview {
  id: string
  type: 'carousel'
  preview: true
  articleId: string
  date: string
  caption: string
  slides: SlideSpec[]
}

/**
 * Intégration Instagram.
 *
 * Instagram n'expose plus aucune publication sans authentification :
 * l'API Basic Display a fermé fin 2024 et l'API Graph exige un compte
 * professionnel, une application Meta et un jeton à renouveler.
 *
 * La voie qui fonctionne sans jeton est l'EMBED OFFICIEL : la publication
 * est rendue par Instagram dans une iframe, avec son média, sa légende et
 * ses flèches de carrousel d'origine. Le contenu est monté en JavaScript
 * côté navigateur — il ne se voit donc pas en récupérant l'URL en ligne
 * de commande, seulement dans une vraie page.
 *
 * Pour ajouter une publication : copie son adresse depuis Instagram et
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

/**
 * Carrousels : format prévu, pas encore publié.
 * Cette maquette de démonstration montre le rendu qui attend tes vrais
 * carrousels — dès que tu en publies un, colle son identifiant dans
 * IG_MEDIA ci-dessus et l'embed officiel prend sa place.
 */
export const IG_CAROUSEL_PREVIEW: CarouselPreview = {
  id: 'apercu-carrousel',
  type: 'carousel',
  preview: true,
  articleId: 'controler-lia',
  date: '2026-09-11',
  caption:
    "L'Europe répète le mot « souveraineté » pendant que ses calculs tournent ailleurs. Cinq volets, article complet en lien.",
  slides: [
    {
      type: 'cover',
      title: "Contrôler l'IA, contrôler le Monde",
      kicker: 'Souveraineté numérique',
    },
    {
      type: 'stat',
      figure: '900 M',
      label: "de personnes utilisent l'IA chaque semaine en 2026",
      source: "Chiffre cité dans l'article",
    },
    {
      type: 'stat',
      figure: '581 Md$',
      label: "le marché de l'IA en 2025, contre 222 milliards en 2020",
      source: 'Source : Stanford HAI',
    },
    {
      type: 'quote',
      text: "Celui qui deviendra le leader de l'IA sera le maître du monde.",
      attribution: 'Vladimir Poutine, 2017',
    },
    {
      type: 'outro',
      title: 'La suite en version longue',
      body: 'Mistral, ASML, Commission européenne : ce que recouvre vraiment le mot souveraineté.',
      cta: "Lire l'article",
    },
  ],
}

export const findMedia = (id: string): IgMedia | CarouselPreview | undefined =>
  id === IG_CAROUSEL_PREVIEW.id ? IG_CAROUSEL_PREVIEW : IG_MEDIA.find((m) => m.id === id)
