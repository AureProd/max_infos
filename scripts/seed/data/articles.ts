import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Article } from '../../../shared/types/content'

// Lecture par le système de files, et non par les imports `?raw` de
// Vite : ce file ne tourne plus que dans Node, au moment du semis.
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..', 'content')
const BODIES: Record<string, string> = Object.fromEntries(
  ['controler-lia', 'fifa', 'cri-dequoy', 'ni-dici-ni-dailleurs', 'ben-mhidi'].map((slug) => [
    slug,
    readFileSync(join(FOLDER, `${slug}.md`), 'utf8'),
  ]),
)

/**
 * Articles longs, importés du Substack « Un Max d'info ».
 *
 * TEMPORAIRE : au lot 3, un script les écrit en base et ce file
 * disparaît au profit de `GET /api/articles`. Les .md vivent déjà dans
 * scripts/seed/content/, leur emplacement définitif.
 */
/** Lève si un body manque, plutôt que de publier un article vide. */
function bodyOf(slug: string): string {
  const body = BODIES[slug]
  if (!body) throw new Error(`Corps introuvable pour l'article « ${slug} »`)
  return body
}

export const ARTICLES: Article[] = [
  {
    id: 'controler-lia',
    title: 'Contrôler l’IA, contrôler le Monde',
    dek: 'Comment la souveraineté numérique européenne se transforme en simple slogan.',
    date: '2026-09-11',
    minutes: 7,
    chars: 10013,
    tags: ['géopolitique', 'numérique', 'Europe'],
    ratio: '3 / 2',
    cover:
      'https://substackcdn.com/image/fetch/$s_!YvGY!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fdfc7db0f-e780-42a4-a97d-cb56c790b291_1080x1350.png',
    substack: 'https://unmaxdinfo.substack.com/p/controler-lia-controler-le-monde',
    body: bodyOf('controler-lia'),
  },
  {
    id: 'fifa',
    title: '“La FIFA mérite un leader, pas un dealer”',
    dek: 'Comment Gianni Infantino a transformé le football mondial en pouvoir politique et économique.',
    date: '2026-09-08',
    minutes: 6,
    chars: 7906,
    tags: ['sport', 'pouvoir'],
    ratio: '1 / 1',
    cover:
      'https://substackcdn.com/image/fetch/$s_!GeFj!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F47e65bff-f71d-40f2-8ad0-f4321320882a_1080x1350.png',
    substack: 'https://unmaxdinfo.substack.com/p/la-fifa-merite-un-leader-pas-un-dealer',
    body: bodyOf('fifa'),
  },
  {
    id: 'cri-dequoy',
    title: '"Gardez le votre anglais" : le cri Dequoy qui n\'en finit pas de hanter le Québec',
    dek: 'Trois ans après le “coup de gueule” du joueur de football canadien, la question linguistique s’invite dans la campagne électorale.',
    date: '2026-09-04',
    minutes: 3,
    chars: 3889,
    tags: ['langue', 'Québec', 'sport'],
    ratio: '4 / 5',
    cover:
      'https://substackcdn.com/image/fetch/$s_!Vzsy!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F9a001eff-bc56-4941-b0f6-b9e53d08959a_1080x1350.png',
    substack: 'https://unmaxdinfo.substack.com/p/gardez-le-votre-anglais-le-cri-dequoy',
    body: bodyOf('cri-dequoy'),
  },
  {
    id: 'ni-dici-ni-dailleurs',
    title: 'Ni tout à fait d’ici, ni tout à fait d’ailleurs',
    dek: 'Comment JeanJass, TIF et Mairo transforment leur double identité en matière artistique ?',
    date: '2026-09-02',
    minutes: 6,
    chars: 8766,
    tags: ['culture', 'identité'],
    ratio: '3 / 2',
    cover:
      'https://substackcdn.com/image/fetch/$s_!dCdF!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0f9e2a7e-2c3b-4bb5-b308-bfb0292693ba_1080x1350.png',
    substack: 'https://unmaxdinfo.substack.com/p/ni-tout-a-fait-dici-ni-tout-a-fait',
    body: bodyOf('ni-dici-ni-dailleurs'),
  },
  {
    id: 'ben-mhidi',
    title: 'Quand la France reconnaît l\'assassinat du "Jean Moulin Algérien"',
    dek: 'Les enjeux des opérations de pacifications mémorielles franco-algériennes.',
    date: '2026-07-26',
    minutes: 2,
    chars: 3437,
    tags: ['mémoire', 'Algérie'],
    ratio: '4 / 5',
    cover:
      'https://substackcdn.com/image/fetch/$s_!SUbw!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0f772996-0272-42b0-ae24-71b26bd1c4bb_1080x1350.png',
    substack: 'https://unmaxdinfo.substack.com/p/quand-la-france-reconnait-lassassinat',
    body: bodyOf('ben-mhidi'),
  },
]
