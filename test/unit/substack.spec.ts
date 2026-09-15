import { describe, expect, it } from 'vitest'
import { parseSubstackFeed } from '../../server/utils/substack'

/** A feed of the exact shape Substack produces, cut down to the essentials. */
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title><![CDATA[Un Max d'info]]></title>
  <item>
    <title><![CDATA[Ben M'hidi, l'homme qu'on n'a pas pu faire taire]]></title>
    <link>https://unmaxdinfo.substack.com/p/ben-mhidi</link>
    <pubDate>Tue, 04 Mar 2026 08:00:00 GMT</pubDate>
    <description><![CDATA[<p>Une enquête sur la mémoire.</p>]]></description>
    <enclosure url="https://substackcdn.com/image/fetch/cover.jpg" type="image/jpeg"/>
    <content:encoded><![CDATA[<p>Le corps complet.</p>]]></content:encoded>
  </item>
  <item>
    <title>FIFA &amp; le pouvoir</title>
    <link>https://unmaxdinfo.substack.com/p/fifa</link>
    <pubDate>date illisible</pubDate>
    <description>Sans cover d&#39;origine.</description>
    <content:encoded><![CDATA[<p>Texte</p><img src="https://substackcdn.com/image/dans-le-corps.png"/>]]></content:encoded>
  </item>
  <item>
    <title>Brouillon sans lien</title>
  </item>
</channel>
</rss>`

describe('flux Substack', () => {
  const articles = parseSubstackFeed(FEED)

  it('écarte les entrées sans titre ou sans lien', () => {
    // An incomplete entry would create a ghost article, impossible to
    // attach to anything.
    expect(articles).toHaveLength(2)
  })

  it('sort les CDATA et les apostrophes intactes', () => {
    expect(articles[0]?.title).toBe("Ben M'hidi, l'homme qu'on n'a pas pu faire taire")
  })

  it('décode les entités sans les décoder deux fois', () => {
    expect(articles[1]?.title).toBe('FIFA & le pouvoir')
    expect(articles[1]?.dek).toBe("Sans cover d'origine.")
  })

  it('ne confond pas le chapô et le corps', () => {
    // `description` is truncated by Substack: importing a body from it
    // would give amputated articles, with nothing to report it.
    expect(articles[0]?.dek).toBe('Une enquête sur la mémoire.')
    expect(articles[0]?.bodyHtml).toBe('<p>Le corps complet.</p>')
  })

  it('prend la cover de l’enclosure quand elle existe', () => {
    expect(articles[0]?.cover).toBe('https://substackcdn.com/image/fetch/cover.jpg')
  })

  it('retombe sur la première image du corps sinon', () => {
    expect(articles[1]?.cover).toBe('https://substackcdn.com/image/dans-le-corps.png')
  })

  it('normalise la date, et tolère qu’elle soit illisible', () => {
    expect(articles[0]?.publishedAt).toBe('2026-03-04T08:00:00.000Z')
    expect(articles[1]?.publishedAt).toBeNull()
  })
})
