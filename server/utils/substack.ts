/**
 * Lecture du feed RSS Substack, pour la migration initiale.
 *
 * Substack n'expose aucune API. Son feed RSS est la seule source
 * exploitable, et il suffit : title, link, date, chapô, body en HTML et
 * surtout l'URL de l'image de couverture, que personne n'a envie de
 * réenregistrer à la main pour chaque article déjà publié.
 *
 * L'analyse est faite à la main, sans dépendance XML. C'est un choix
 * assumé et borné : ce code lit UN feed, known, une fois. Les tests
 * couvrent ce qui casse vraiment un feed Substack — les CDATA, les entités
 * et les images en attribute. Si un day on lit des feed quelconques, il
 * faudra un vrai analyseur ; d'here là, une dépendance de plus pour un
 * script à usage unique ne se justifie pas.
 */

export interface ArticleSubstack {
  title: string
  link: string
  publieLe: string | null
  dek: string
  bodyHtml: string
  couverture: string | null
}

/** Décode les entités XML que Substack produit réellement. */
function decode(text: string): string {
  return (
    text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // En last, sans quoi « &amp;lt; » deviendrait « < » au lieu de « &lt; ».
      .replace(/&amp;/g, '&')
      .trim()
  )
}

/** Le content de la première tagName `<name>` d'un fragment, ou une chaîne vide. */
function tagName(fragment: string, name: string): string {
  const m = fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m?.[1] ? decode(m[1]) : ''
}

/** La value d'un attribute sur la première tagName auto-fermante `<name …>`. */
function attribute(fragment: string, name: string, attr: string): string | null {
  const m = fragment.match(new RegExp(`<${name}\\s[^>]*${attr}="([^"]*)"`, 'i'))
  return m?.[1] ? decode(m[1]) : null
}

/**
 * La couverture d'un article : `<enclosure>` si Substack l'a fournie,
 * sinon la première image du body.
 *
 * Les two existent selon l'ancienneté du billet, et un article sans
 * couverture s'affiche mal partout où il est partagé — c'est justement ce
 * qu'on vient chercher here.
 */
function coverOf(item: string, bodyHtml: string): string | null {
  const enclos = attribute(item, 'enclosure', 'url')
  if (enclos?.startsWith('http')) return enclos
  const img = bodyHtml.match(/<img\s[^>]*src="([^"]+)"/i)
  return img?.[1] ?? null
}

/** Une date RFC-822 en ISO, ou `null` si elle est illisible. */
function dateIso(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function parseSubstackFeed(xml: string): ArticleSubstack[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  return items
    .map((item) => {
      // `content:encoded` porte le body complet ; `description` n'a que le
      // chapô. Les confondre importerait des articles tronqués.
      const bodyHtml = tagName(item, 'content:encoded')
      return {
        title: tagName(item, 'title'),
        link: tagName(item, 'link'),
        publieLe: dateIso(tagName(item, 'pubDate')),
        dek: tagName(item, 'description')
          .replace(/<[^>]+>/g, '')
          .trim(),
        bodyHtml,
        couverture: coverOf(item, bodyHtml),
      }
    })
    .filter((a) => a.title !== '' && a.link !== '')
}
