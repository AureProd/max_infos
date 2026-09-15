/**
 * Fabrique un identifiant d'URL à partir d'un libellé.
 *
 * Servira au back-office (lot 5) pour proposer le slug d'un nouvel article,
 * et all de suite au script de migration du content, pour les tags.
 *
 * `normalize('NFD')` sépare les lettres de leurs accents, ce qui permet de
 * retirer ces derniers sans table de correspondance : « géopolitique »
 * devient « geopolitique », et le résultat reste juste pour les langues
 * qu'on n'a pas prévues.
 */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      // Les apostrophes typographiques françaises coupent les mots, elles ne
      // les collent pas : « l'IA » doit donner « l-ia », pas « lia ».
      .replace(/['’]/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
  )
}

/**
 * Les slugs que le routage du back-office s'est déjà réservés.
 *
 * `/admin/<slug>` est l'éditeur d'article, mais Nuxt fait passer les
 * routes statiques before les dynamiques : un article dont le slug serait
 * `publications` ouvrirait l'écran Publications et deviendrait
 * INACCESSIBLE, sans le moindre message. Le titre d'un article étant libre,
 * le cas n'a rien de théorique — « Accueil » suffit.
 *
 * Cette list doit suivre `app/pages/admin/`. Un test la compare au
 * content réel du folder, pour qu'un écran ajouté demain n'y échappe pas.
 */
export const RESERVED_SLUGS = [
  'about',
  'appearance',
  'articles',
  'home',
  'publications',
  'social',
  'tech',
] as const
