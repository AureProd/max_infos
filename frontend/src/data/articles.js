import controlerLia from '@/content/controler-lia.md?raw'
import fifa from '@/content/fifa.md?raw'
import criDequoy from '@/content/cri-dequoy.md?raw'
import niDiciNiDailleurs from '@/content/ni-dici-ni-dailleurs.md?raw'
import benMhidi from '@/content/ben-mhidi.md?raw'

const BODIES = {
  'controler-lia': controlerLia,
  fifa,
  'cri-dequoy': criDequoy,
  'ni-dici-ni-dailleurs': niDiciNiDailleurs,
  'ben-mhidi': benMhidi
}

/**
 * Articles longs, importés du Substack « Un Max d'info ».
 * Le texte vit dans src/content/*.md ; en production il viendra de l'API.
 */
export const ARTICLES = [
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
    body: BODIES['controler-lia']
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
    body: BODIES['fifa']
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
    body: BODIES['cri-dequoy']
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
    body: BODIES['ni-dici-ni-dailleurs']
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
    body: BODIES['ben-mhidi']
  }
]
