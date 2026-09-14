/**
 * Lecture du flux RSS Substack, pour la migration initiale.
 *
 * Substack n'expose aucune API. Son flux RSS est la seule source
 * exploitable, et il suffit : titre, lien, date, chapô, corps en HTML et
 * surtout l'URL de l'image de couverture, que personne n'a envie de
 * réenregistrer à la main pour chaque article déjà publié.
 *
 * L'analyse est faite à la main, sans dépendance XML. C'est un choix
 * assumé et borné : ce code lit UN flux, connu, une fois. Les tests
 * couvrent ce qui casse vraiment un flux Substack — les CDATA, les entités
 * et les images en attribut. Si un jour on lit des flux quelconques, il
 * faudra un vrai analyseur ; d'ici là, une dépendance de plus pour un
 * script à usage unique ne se justifie pas.
 */

export interface ArticleSubstack {
  titre: string
  lien: string
  publieLe: string | null
  chapo: string
  corpsHtml: string
  couverture: string | null
}

/** Décode les entités XML que Substack produit réellement. */
function decoder(texte: string): string {
  return (
    texte
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // En dernier, sans quoi « &amp;lt; » deviendrait « < » au lieu de « &lt; ».
      .replace(/&amp;/g, '&')
      .trim()
  )
}

/** Le contenu de la première balise `<nom>` d'un fragment, ou une chaîne vide. */
function balise(fragment: string, nom: string): string {
  const m = fragment.match(new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, 'i'))
  return m?.[1] ? decoder(m[1]) : ''
}

/** La valeur d'un attribut sur la première balise auto-fermante `<nom …>`. */
function attribut(fragment: string, nom: string, attr: string): string | null {
  const m = fragment.match(new RegExp(`<${nom}\\s[^>]*${attr}="([^"]*)"`, 'i'))
  return m?.[1] ? decoder(m[1]) : null
}

/**
 * La couverture d'un article : `<enclosure>` si Substack l'a fournie,
 * sinon la première image du corps.
 *
 * Les deux existent selon l'ancienneté du billet, et un article sans
 * couverture s'affiche mal partout où il est partagé — c'est justement ce
 * qu'on vient chercher ici.
 */
function couvertureDe(item: string, corpsHtml: string): string | null {
  const enclos = attribut(item, 'enclosure', 'url')
  if (enclos?.startsWith('http')) return enclos
  const img = corpsHtml.match(/<img\s[^>]*src="([^"]+)"/i)
  return img?.[1] ?? null
}

/** Une date RFC-822 en ISO, ou `null` si elle est illisible. */
function dateIso(brut: string): string | null {
  if (!brut) return null
  const d = new Date(brut)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function analyserFluxSubstack(xml: string): ArticleSubstack[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return items
    .map((item) => {
      // `content:encoded` porte le corps complet ; `description` n'a que le
      // chapô. Les confondre importerait des articles tronqués.
      const corpsHtml = balise(item, 'content:encoded')
      return {
        titre: balise(item, 'title'),
        lien: balise(item, 'link'),
        publieLe: dateIso(balise(item, 'pubDate')),
        chapo: balise(item, 'description')
          .replace(/<[^>]+>/g, '')
          .trim(),
        corpsHtml,
        couverture: couvertureDe(item, corpsHtml),
      }
    })
    .filter((a) => a.titre !== '' && a.lien !== '')
}
