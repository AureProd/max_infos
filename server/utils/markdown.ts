import { Marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Rendu Markdown de référence, exécuté CÔTÉ SERVEUR au moment de
 * l'record, jamais à la lecture.
 *
 * Trois conséquences, et c'est all l'intérêt :
 *  - afficher un article ne coûte plus aucun rendered ;
 *  - le HTML servi est assaini PAR CONSTRUCTION, et non parce qu'on aura
 *    pensé à le faire à chaque endroit qui l'affiche ;
 *  - l'aperçu du back-office passe par la même fonction, donc ne peut pas
 *    diverger du rendered publié.
 *
 * Remplace le engine maison de la maquette, retiré au lot 5 : il écrivait
 * href="..." sans rien vérifier, et le rendered se faisait à l'affichage.
 */

const engine = new Marked({
  gfm: true,
  breaks: false,
})

/**
 * La list blanche. Tout ce qui n'y figure pas est retiré — y compris les
 * tagNames que `marked` sait produire mais qu'on ne veut pas voir dans un
 * article (`<script>`, `<iframe>`, `<form>`, `<style>`).
 */
const RULES: sanitizeHtml.IOptions = {
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
    // target et rel doivent figurer here : transformTags les ajoute, mais
    // l'assainissement passe APRÈS et retirerait all attribute non déclaré.
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
    // Pour la coloration syntaxique, plus tard.
    code: ['class'],
    th: ['align'],
    td: ['align'],
  },
  // Le seul endroit où l'on décide ce qu'un link peut viser. `javascript:`,
  // `data:` et consorts ne sont pas dans la list, donc l'attribute saute.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // Un link sortant ouvert dans un nouvel onglet sans `rel` donne à la
    // page target l'accès à `window.opener`. Posé systématiquement.
    a: (name, attribs) => {
      const href = attribs.href ?? ''
      const external = /^https?:\/\//i.test(href)
      return {
        tagName: name,
        attribs: external ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      }
    },
    img: (name, attribs) => ({ tagName: name, attribs: { ...attribs, loading: 'lazy' } }),
  },
}

/** Markdown → HTML assaini. La seule fonction autorisée à produire du HTML d'article. */
export function renderMarkdown(source: string): string {
  const raw = engine.parse(source ?? '', { async: false })
  return sanitizeHtml(raw, RULES)
}

/**
 * Nombre de caractères, espaces normalisées. Sert au compteur affiché et à
 * l'estimation du temps de lecture.
 */
export function countCharacters(source: string): number {
  return (source ?? '').replace(/\s+/g, ' ').trim().length
}

/**
 * Temps de lecture en minutes, arrondi au-dessus, minimum 1.
 *
 * 1 400 caractères par minute, soit environ 230 mots — la fourchette basse
 * des mesures de lecture en français. Mieux vaut annoncer un peu long.
 */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.ceil(countCharacters(source) / 1400))
}
