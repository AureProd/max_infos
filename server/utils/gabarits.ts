/**
 * Résolution des variables d'un gabarit de déclinaison.
 *
 * Le but est que Max parte d'un squelette au lieu d'une page blanche. Les
 * variables sont volontairement peu nombreuses et nommées en français : un
 * gabarit doit rester lisible par quelqu'un qui n'écrit pas de code.
 */

export interface ContexteArticle {
  titre: string
  chapo: string
  url: string
  sujets: string
  minutes: number
  caracteres: number
}

const MOTIF = /\{\{\s*([a-zA-Zà-ÿ]+)\s*\}\}/g

/**
 * Remplace les variables connues. Une variable INCONNUE est laissée telle
 * quelle, et non effacée : Max voit alors qu'il s'est trompé de nom, au
 * lieu de découvrir un trou dans son texte.
 */
export function resoudre(gabarit: string, contexte: ContexteArticle): string {
  const valeurs: Record<string, string> = {
    titre: contexte.titre,
    chapo: contexte.chapo,
    url: contexte.url,
    sujets: contexte.sujets,
    minutes: String(contexte.minutes),
    caracteres: String(contexte.caracteres),
  }
  return gabarit.replace(MOTIF, (tout, nom: string) => valeurs[nom.toLowerCase()] ?? tout)
}

/** Les noms de variables reconnus, pour l'aide affichée dans l'admin. */
export const VARIABLES = ['titre', 'chapo', 'url', 'sujets', 'minutes', 'caracteres'] as const

export const GABARITS_PAR_DEFAUT = {
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
