/**
 * Builds a URL identifier from a label.
 *
 * Used by the back-office to suggest the slug of a new article, and right
 * away by the content migration script, for tags.
 *
 * `normalize('NFD')` splits letters from their accents, which strips the
 * latter without a lookup table: « géopolitique » becomes « geopolitique »,
 * and the result stays correct for languages we did not plan for.
 */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      // French typographic apostrophes split words, they do not glue them:
      // « l'IA » must give « l-ia », not « lia ».
      .replace(/['’]/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
  )
}

/**
 * The slugs the back-office routing has already claimed.
 *
 * `/admin/<slug>` is the article editor, but Nuxt puts static routes ahead
 * of dynamic ones: an article whose slug was `publications` would open the
 * Publications screen and become UNREACHABLE, without a single message. An
 * article title being free text, the case is anything but theoretical —
 * « Accueil » is enough.
 *
 * This list must follow `app/pages/admin/`. A test compares it to the real
 * contents of the folder, so that a screen added tomorrow cannot slip past.
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
