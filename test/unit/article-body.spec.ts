import { describe, expect, it } from 'vitest'
import {
  countCharacters,
  htmlToText,
  readingMinutes,
  sanitizeArticleHtml,
} from '~~/server/utils/markdown'

/**
 * The body of an article is now HTML, written by the editor.
 *
 * Which moves the security question: it used to be impossible to store
 * unsafe markup because the only way in was Markdown, rendered by us. Now
 * the browser hands over HTML directly, and THIS function is the single
 * place that decides what may be kept. It runs at save time, server-side —
 * never on display.
 */
describe('sanitizeArticleHtml', () => {
  it('keeps the markup an article is made of', () => {
    const html =
      '<h2>Un titre</h2><p>Du <strong>gras</strong>, de l’<em>italique</em>.</p><ul><li>Un point</li></ul><blockquote><p>Une citation</p></blockquote>'
    expect(sanitizeArticleHtml(html)).toBe(html)
  })

  it('removes a script, whatever it is dressed as', () => {
    expect(sanitizeArticleHtml('<p>Bonjour</p><script>alert(1)</script>')).toBe('<p>Bonjour</p>')
    expect(sanitizeArticleHtml('<p onclick="alert(1)">Bonjour</p>')).toBe('<p>Bonjour</p>')
    expect(sanitizeArticleHtml('<iframe src="https://exemple.test"></iframe>')).toBe('')
  })

  it('refuses a link that is not a link', () => {
    // `javascript:` n'est pas dans la liste des schémas : l'attribut tombe.
    expect(sanitizeArticleHtml('<p><a href="javascript:alert(1)">clic</a></p>')).toBe(
      '<p><a>clic</a></p>',
    )
  })

  it('opens an outgoing link in a new tab, sans donner window.opener', () => {
    const out = sanitizeArticleHtml('<p><a href="https://exemple.test">là-bas</a></p>')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('leaves an internal link alone', () => {
    expect(sanitizeArticleHtml('<p><a href="/article/x">ici</a></p>')).toBe(
      '<p><a href="/article/x">ici</a></p>',
    )
  })

  it('keeps the Substack buttons the editor inserts', () => {
    // Un nœud dédié plutôt que du HTML collé : la classe doit survivre.
    const html =
      '<p class="article-cta"><a href="https://unmaxdinfo.substack.com/subscribe">S’abonner</a></p>'
    expect(sanitizeArticleHtml(html)).toContain('class="article-cta"')
  })
})

/**
 * Le texte brut, dérivé du corps.
 *
 * La recherche SQL cherchait dans le Markdown : un article contenant
 * « **souveraineté** » ne répondait pas à « souveraineté », et les
 * résultats montraient des `[texte](adresse)`. Elle cherche désormais ici.
 */
describe('htmlToText', () => {
  it('rend le texte, sans une seule balise', () => {
    expect(htmlToText('<h2>Titre</h2><p>Un <strong>mot</strong> gras.</p>')).toBe(
      'Titre Un mot gras.',
    )
  })

  it('sépare deux blocs par une espace, et non par rien', () => {
    // Collés, « Titre » et « Un » formaient « TitreUn », introuvable.
    expect(htmlToText('<p>Titre</p><p>Un</p>')).toBe('Titre Un')
  })

  it('remet les entités en caractères', () => {
    expect(htmlToText('<p>L&#39;enqu&ecirc;te &amp; la suite</p>')).toBe("L'enquête & la suite")
  })

  it('ne rend rien d’un corps vide', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText('<p></p>')).toBe('')
  })
})

describe('les compteurs', () => {
  it('comptent le TEXTE, pas les balises', () => {
    // « <p><strong>Bonjour</strong></p> » fait 31 caractères de source pour
    // 7 de lecture : compter la source annonçait des temps faux.
    expect(countCharacters(htmlToText('<p><strong>Bonjour</strong></p>'))).toBe(7)
  })

  it('annoncent au moins une minute', () => {
    expect(readingMinutes('court')).toBe(1)
  })
})
