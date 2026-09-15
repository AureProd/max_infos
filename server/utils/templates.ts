/**
 * Résolution des variables d'un gabarit de déclinaison.
 *
 * Le but est que Max parte d'un squelette au lieu d'une page blanche. Les
 * variables sont volontairement peu nombreuses et nommées en français : un
 * template doit rester lisible par quelqu'un qui n'écrit pas de code.
 */

export interface ArticleContext {
  titre: string
  chapo: string
  url: string
  tags: string
  minutes: number
  caracteres: number
}

const PATTERN = /\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g

/**
 * Remplace les variables connues. Une variable INCONNUE est laissée telle
 * quelle, et non effacée : Max voit alors qu'il s'est trompé de name, au
 * lieu de découvrir un trou dans son text.
 */
export function resolve(template: string, context: ArticleContext): string {
  const values: Record<string, string> = {
    titre: context.titre,
    chapo: context.chapo,
    url: context.url,
    // La CLÉ est le nom de variable écrit par Max dans son gabarit : elle
    // relève du contenu, et reste donc en français.
    sujets: context.tags,
    minutes: String(context.minutes),
    caracteres: String(context.caracteres),
  }
  return template.replace(PATTERN, (all, name: string) => values[name.toLowerCase()] ?? all)
}

/** Les noms de variables reconnus, pour l'aide affichée dans l'admin. */
export const VARIABLES = ['titre', 'chapo', 'url', 'sujets', 'minutes', 'caracteres'] as const

export const DEFAULT_TEMPLATES = {
  linkedin: `{{titre}}

{{chapo}}

J'y reviens en détail dans l'article, {{minutes}} min de lecture :
{{url}}

#{{sujets}}`,
  reel: `ACCROCHE — une phrase qui pose la question.

DÉVELOPPEMENT — trois idées, une par plan.

CHUTE — ce qu'il faut retenir.

CARTON FINAL : « {{titre}} », article complet en bio.`,
}
