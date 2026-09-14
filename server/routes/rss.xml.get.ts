import { desc, eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { article, media } from '~~/server/database/schema'
import { lireReglage } from '~~/server/utils/reglages'

/** Échappement XML. Un titre contenant « & » casserait le flux sans cela. */
const x = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Flux RSS des articles publiés.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : le format est stable
 * depuis vingt ans, et une dépendance de plus pour produire quarante lignes
 * de XML n'est pas un bon échange. Le validateur du W3C reste le juge.
 */
export default defineEventHandler(async (event) => {
  const { public: pub } = useRuntimeConfig()
  const base = pub.baseUrl.replace(/\/+$/, '')
  const identite = await lireReglage('identity')

  const articles = await useBase()
    .select({
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      bodyHtml: article.bodyHtml,
      publishedAt: article.publishedAt,
      coverUrl: media.url,
    })
    .from(article)
    .leftJoin(media, eq(media.id, article.coverMediaId))
    .where(eq(article.status, 'published'))
    .orderBy(desc(article.publishedAt))
    .limit(50)

  const items = articles
    .map((a) => {
      const lien = `${base}/article/${a.slug}`
      return `    <item>
      <title>${x(a.title)}</title>
      <link>${x(lien)}</link>
      <guid isPermaLink="true">${x(lien)}</guid>
      <pubDate>${a.publishedAt?.toUTCString() ?? ''}</pubDate>
      <description>${x(a.dek ?? '')}</description>
      <content:encoded><![CDATA[${a.bodyHtml}]]></content:encoded>${
        a.coverUrl ? `\n      <enclosure url="${x(a.coverUrl)}" type="image/jpeg" />` : ''
      }
    </item>`
    })
    .join('\n')

  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${x(identite.name)}</title>
    <link>${x(base)}</link>
    <description>${x(identite.tagline)}</description>
    <language>fr</language>
    <atom:link href="${x(base)}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
})
