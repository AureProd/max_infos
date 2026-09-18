import { describe, expect, it } from 'vitest'
import { cdata } from '../../server/utils/serialize'

/**
 * `]]>` ne sort pas d'une section CDATA.
 *
 * Le corps d'un article y est posé tel quel. Une section CDATA se termine
 * au premier `]]>` rencontré : tout ce qui suit redevient du XML, et un
 * lecteur de flux l'interprète comme du balisage. Aujourd'hui
 * l'assainissement échappe le `>`, donc rien ne passe — mais le flux
 * dépendait alors d'une invariante écrite ailleurs, et c'est exactement le
 * genre de lien que personne ne relit. La section se ferme et se rouvre
 * autour de la séquence : le texte est inchangé, la sortie ne l'est plus.
 */
describe('une section CDATA', () => {
  it('coupe la séquence qui la fermerait', () => {
    const out = cdata('avant ]]> après')
    expect(out).toBe('<![CDATA[avant ]]]]><![CDATA[> après]]>')
    /*
     * Ce qui compte n'est pas l'absence de `]]>` — la forme échappée en
     * contient un, qui ferme la première section — mais le fait que
     * CHACUN soit aussitôt suivi d'une réouverture. Un lecteur recolle
     * alors le texte d'origine, ce que cette lecture vérifie.
     */
    expect(out.startsWith('<![CDATA[')).toBe(true)
    expect(out.endsWith(']]>')).toBe(true)
    const recolle = out.slice(9, -3).replaceAll(']]><![CDATA[', '')
    expect(recolle).toBe('avant ]]> après')
  })

  it('laisse un corps ordinaire intact', () => {
    expect(cdata('<p>Bonjour</p>')).toBe('<![CDATA[<p>Bonjour</p>]]>')
  })

  it('accepte le vide', () => {
    expect(cdata('')).toBe('<![CDATA[]]>')
  })
})
