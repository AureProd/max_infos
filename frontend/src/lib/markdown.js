/**
 * Rendu Markdown minimal : titres, paragraphes, listes, citations,
 * blocs de code, gras, italique, code en ligne et liens.
 * La même fonction sert aux articles et à la prévisualisation du back-office.
 *
 * Les blocs de code sont délimités par ~~~ et non par des accents graves,
 * pour rester lisibles dans un champ de saisie.
 */
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

export function renderMarkdown(src) {
  const out = []
  const lines = String(src).replace(/\r/g, '').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^~~~/.test(line)) {
      const buf = []
      i++
      while (i < lines.length && !/^~~~/.test(lines[i])) buf.push(lines[i++])
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
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]))
        buf.push(`<li>${inline(lines[i++].replace(/^\d+\.\s+/, ''))}</li>`)
      out.push(`<ol>${buf.join('')}</ol>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i]))
        buf.push(`<li>${inline(lines[i++].replace(/^[-*]\s+/, ''))}</li>`)
      out.push(`<ul>${buf.join('')}</ul>`)
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }

    const buf = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{2,3}\s|>|~~~|[-*]\s|\d+\.\s|---\s*$)/.test(lines[i])
    )
      buf.push(lines[i++])
    out.push(`<p>${inline(buf.join(' '))}</p>`)
  }

  return out.join('\n')
}
