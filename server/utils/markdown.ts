import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Rendu Markdown de référence, exécuté CÔTÉ SERVEUR au moment de
 * l'enregistrement, jamais à la lecture.
 *
 * Trois conséquences, et c'est tout l'intérêt :
 *  - afficher un article ne coûte plus aucun rendu ;
 *  - le HTML servi est assaini PAR CONSTRUCTION, et non parce qu'on aura
 *    pensé à le faire à chaque endroit qui l'affiche ;
 *  - l'aperçu du back-office passe par la même fonction, donc ne peut pas
 *    diverger du rendu publié.
 *
 * Remplace le moteur maison de la maquette, retiré au lot 5 : il écrivait
 * href="..." sans rien vérifier, et le rendu se faisait à l'affichage.
 */

const moteur = new Marked({
  gfm: true,
  breaks: false,
})

/**
 * La liste blanche. Tout ce qui n'y figure pas est retiré — y compris les
 * balises que `marked` sait produire mais qu'on ne veut pas voir dans un
 * article (`<script>`, `<iframe>`, `<form>`, `<style>`).
 */
const REGLES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h2',
    'h3',
    'h4',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    // target et rel doivent figurer ici : transformTags les ajoute, mais
    // l'assainissement passe APRÈS et retirerait tout attribut non déclaré.
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
    // Pour la coloration syntaxique, plus tard.
    code: ['class'],
    th: ['align'],
    td: ['align'],
  },
  // Le seul endroit où l'on décide ce qu'un lien peut viser. `javascript:`,
  // `data:` et consorts ne sont pas dans la liste, donc l'attribut saute.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // Un lien sortant ouvert dans un nouvel onglet sans `rel` donne à la
    // page cible l'accès à `window.opener`. Posé systématiquement.
    a: (nom, attribs) => {
      const href = attribs.href ?? ''
      const externe = /^https?:\/\//i.test(href)
      return {
        tagName: nom,
        attribs: externe ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      }
    },
    img: (nom, attribs) => ({ tagName: nom, attribs: { ...attribs, loading: 'lazy' } }),
  },
}

/** Markdown → HTML assaini. La seule fonction autorisée à produire du HTML d'article. */
export function rendreMarkdown(source: string): string {
  const brut = moteur.parse(source ?? '', { async: false })
  return sanitizeHtml(brut, REGLES)
}

/**
 * Nombre de caractères, espaces normalisées. Sert au compteur affiché et à
 * l'estimation du temps de lecture.
 */
export function compterCaracteres(source: string): number {
  return (source ?? '').replace(/\s+/g, ' ').trim().length
}

/**
 * Temps de lecture en minutes, arrondi au-dessus, minimum 1.
 *
 * 1 400 caractères par minute, soit environ 230 mots — la fourchette basse
 * des mesures de lecture en français. Mieux vaut annoncer un peu long.
 */
export function minutesDeLecture(source: string): number {
  return Math.max(1, Math.ceil(compterCaracteres(source) / 1400))
}
