/**
 * Fabrique un identifiant d'URL à partir d'un libellé.
 *
 * Servira au back-office (lot 5) pour proposer le slug d'un nouvel article,
 * et tout de suite au script de migration du contenu, pour les sujets.
 *
 * `normalize('NFD')` sépare les lettres de leurs accents, ce qui permet de
 * retirer ces derniers sans table de correspondance : « géopolitique »
 * devient « geopolitique », et le résultat reste juste pour les langues
 * qu'on n'a pas prévues.
 */
export function slugify(texte: string): string {
  return (
    texte
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
 * routes statiques avant les dynamiques : un article dont le slug serait
 * `publications` ouvrirait l'écran Publications et deviendrait
 * INACCESSIBLE, sans le moindre message. Le titre d'un article étant libre,
 * le cas n'a rien de théorique — « Accueil » suffit.
 *
 * Cette liste doit suivre `app/pages/admin/`. Un test la compare au
 * contenu réel du dossier, pour qu'un écran ajouté demain n'y échappe pas.
 */
export const SLUGS_RESERVES = [
  'about',
  'appearance',
  'articles',
  'home',
  'publications',
  'social',
  'tech',
] as const
