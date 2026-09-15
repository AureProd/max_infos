/**
 * Resolves the variables of a variant template.
 *
 * The point is that Max starts from a skeleton instead of a blank page. The
 * variables are deliberately few, and NAMED IN FRENCH: a template has to
 * stay readable by someone who does not write code. Their names are
 * content, not identifiers — which is why the keys below are French while
 * everything around them is English.
 */

export interface ArticleContext {
  title: string
  dek: string
  url: string
  tags: string
  minutes: number
  characters: number
}

const PATTERN = /\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g

/**
 * Replaces the known variables. An UNKNOWN variable is left as it is rather
 * than wiped: Max then sees he got a name wrong, instead of discovering a
 * hole in his text.
 */
export function resolve(template: string, context: ArticleContext): string {
  // The KEYS are the variable names Max writes in his template: they are
  // content, and stay French.
  const values: Record<string, string> = {
    titre: context.title,
    chapo: context.dek,
    url: context.url,
    sujets: context.tags,
    minutes: String(context.minutes),
    caracteres: String(context.characters),
  }
  return template.replace(PATTERN, (all, name: string) => values[name.toLowerCase()] ?? all)
}

/** The recognised variable names, for the help shown in the admin. */
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
