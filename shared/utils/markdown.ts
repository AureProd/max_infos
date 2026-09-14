/**
 * Rendu Markdown minimal : titres, paragraphes, listes, citations, blocs de
 * code, gras, italique, code en ligne et liens. La même fonction sert aux
 * articles et à la prévisualisation du back-office.
 *
 * Les blocs de code sont délimités par ~~~ et non par des accents graves,
 * pour rester lisibles dans un champ de saisie.
 *
 * PROVISOIRE : au lot 5, ce moteur maison laisse place à `marked` +
 * assainissement, exécutés CÔTÉ SERVEUR au moment de l'enregistrement, le
 * résultat étant stocké dans `article.body_html`. Il est conservé jusque-là
 * pour que le rendu ne change pas sous les pieds du CSS, réglé sur sa
 * sortie. La bascule s'accompagnera d'un test de comparaison sur les cinq
 * articles existants.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Les schémas d'URL qui peuvent exécuter du code dans le navigateur. */
const SCHEMAS_INTERDITS = /^\s*(javascript|data|vbscript|file)\s*:/i

/**
 * Assainit la cible d'un lien.
 *
 * Le moteur d'origine écrivait `<a href="$2">` sans rien vérifier : une
 * cible `javascript:…` s'exécutait, et un guillemet dans l'URL permettait
 * d'ajouter un attribut arbitraire. Le risque était théorique tant que seul
 * Max écrivait — il cesse de l'être au lot 3, quand l'import Substack fera
 * passer dans ce moteur du texte que Max n'a pas écrit.
 */
function lienSur(url: string): string {
  if (SCHEMAS_INTERDITS.test(url)) return '#'
  return escapeHtml(url).replace(/"/g, '&quot;')
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_tout, texte: string, url: string) => `<a href="${lienSur(url)}">${texte}</a>`,
    )
}

export function renderMarkdown(src: string): string {
  const out: string[] = []
  const lines = String(src).replace(/\r/g, '').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (/^~~~/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^~~~/.test(lines[i] ?? '')) buf.push(lines[i++] ?? '')
      i++
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }
    if (/^###\s+/.test(line)) {
      out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`)
      i++
      continue
    }
    if (/^##\s+/.test(line)) {
      out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`)
      i++
      continue
    }
    if (/^---\s*$/.test(line)) {
      out.push('<hr>')
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i] ?? ''))
        buf.push((lines[i++] ?? '').replace(/^>\s?/, ''))
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? ''))
        buf.push(`<li>${inline((lines[i++] ?? '').replace(/^\d+\.\s+/, ''))}</li>`)
      out.push(`<ol>${buf.join('')}</ol>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? ''))
        buf.push(`<li>${inline((lines[i++] ?? '').replace(/^[-*]\s+/, ''))}</li>`)
      out.push(`<ul>${buf.join('')}</ul>`)
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }

    const buf: string[] = []
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(#{2,3}\s|>|~~~|[-*]\s|\d+\.\s|---\s*$)/.test(lines[i] ?? '')
    )
      buf.push(lines[i++] ?? '')
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }

  return out.join('\n')
}
