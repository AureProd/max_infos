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

describe('Substack feed', () => {
  const articles = parseSubstackFeed(FEED)

  it('discards entries without a title or a link', () => {
    // An incomplete entry would create a ghost article, impossible to
    // attach to anything.
    expect(articles).toHaveLength(2)
  })

  it('comes out with CDATA and apostrophes intact', () => {
    expect(articles[0]?.title).toBe("Ben M'hidi, l'homme qu'on n'a pas pu faire taire")
  })

  it('decodes entities without decoding them twice', () => {
    expect(articles[1]?.title).toBe('FIFA & le pouvoir')
    expect(articles[1]?.dek).toBe("Sans cover d'origine.")
  })

  it('does not confuse the dek with the body', () => {
    // `description` is truncated by Substack: importing a body from it
    // would give amputated articles, with nothing to report it.
    expect(articles[0]?.dek).toBe('Une enquête sur la mémoire.')
    expect(articles[0]?.bodyHtml).toBe('<p>Le corps complet.</p>')
  })

  it('takes the cover from the enclosure when there is one', () => {
    expect(articles[0]?.cover).toBe('https://substackcdn.com/image/fetch/cover.jpg')
  })

  it('falls back to the first image in the body otherwise', () => {
    expect(articles[1]?.cover).toBe('https://substackcdn.com/image/dans-le-corps.png')
  })

  it('normalises the date, and tolerates it being unreadable', () => {
    expect(articles[0]?.publishedAt).toBe('2026-03-04T08:00:00.000Z')
    expect(articles[1]?.publishedAt).toBeNull()
  })
})

describe('an entry without a date', () => {
  it('comes out published at null rather than at the epoch', () => {
    // No <pubDate> at all, which is what a Substack draft produces. The
    // « unreadable date » case is covered above; this one takes the other
    // branch, and an article dated 1970 would sit at the bottom of the
    // listing for good.
    const [article] = parseSubstackFeed(`<rss><channel>
      <item>
        <title>Sans date</title>
        <link>https://unmaxdinfo.substack.com/p/sans-date</link>
      </item>
    </channel></rss>`)
    expect(article?.publishedAt).toBeNull()
  })
})

describe('the dek, which must be plain text', () => {
  it('leaves no tag behind, even one hidden inside another', () => {
    // A single pass of /<[^>]+>/g rebuilds what it strips: removing <b>
    // from « <scr<b>ipt> » leaves « <script> ». The stripping has to run
    // until the text stops changing.
    const [article] = parseSubstackFeed(`<rss><channel>
      <item>
        <title>Chapô piégé</title>
        <link>https://unmaxdinfo.substack.com/p/x</link>
        <description>&lt;scr&lt;b&gt;ipt&gt;alert(1)&lt;/scr&lt;b&gt;ipt&gt;Le vrai chapô.</description>
      </item>
    </channel></rss>`)

    expect(article?.dek).not.toContain('<')
    expect(article?.dek).not.toContain('>')
    expect(article?.dek).toContain('Le vrai chapô.')
  })

  it('keeps the text of an ordinary formatted dek', () => {
    const [article] = parseSubstackFeed(`<rss><channel>
      <item>
        <title>Chapô normal</title>
        <link>https://unmaxdinfo.substack.com/p/y</link>
        <description>&lt;p&gt;Une &lt;em&gt;enquête&lt;/em&gt; sur la mémoire.&lt;/p&gt;</description>
      </item>
    </channel></rss>`)
    expect(article?.dek).toBe('Une enquête sur la mémoire.')
  })
})

describe('the entities Substack really produces', () => {
  /** One item, one description: the shortest path to the dek. */
  function dek(description: string): string | undefined {
    return parseSubstackFeed(`<rss><channel>
      <item>
        <title>T</title>
        <link>https://unmaxdinfo.substack.com/p/z</link>
        <description>${description}</description>
      </item>
    </channel></rss>`)[0]?.dek
  }

  // Measured in production on 16/09/2026: the two imported articles carry
  // « identit&#233; » and « op&#233;rations » in the database, and the site
  // shows them as such — Vue escapes the ampersand, so the reader sees the
  // entity itself.
  it('decodes the numeric entities that shipped broken', () => {
    expect(dek('Comment ils transforment leur double identit&#233;.')).toBe(
      'Comment ils transforment leur double identité.',
    )
  })

  it('decodes hexadecimal and named entities too', () => {
    expect(dek('Un caf&#xE9; &agrave; c&#xF4;t&eacute; du march&eacute;')).toBe(
      'Un café à côté du marché',
    )
    // U+00A0 and not a plain space: `&nbsp;` is French typography here, and
    // flattening it would be a silent change of the text.
    expect(dek('Il r&eacute;pond &laquo;&nbsp;oui&nbsp;&raquo;')).toBe(
      'Il répond «\u00A0oui\u00A0»',
    )
  })

  it('decodes the typographic apostrophe and dashes Substack emits', () => {
    expect(dek('L&#8217;enqu&#234;te &#8212; au long cours')).toBe('L’enquête — au long cours')
  })

  // The ordering trap, already why `&amp;` is replaced last: a feed that
  // escaped its own ampersand means the ENTITY as text, not the character.
  // Decoding after `&amp;` would turn « &amp;#233; » into « é ».
  it('does not decode an entity that was itself escaped', () => {
    expect(dek('Le code &amp;#233; s&apos;écrit ainsi')).toBe("Le code &#233; s'écrit ainsi")
  })

  it('leaves a lone ampersand alone', () => {
    expect(dek('FIFA &amp; le pouvoir')).toBe('FIFA & le pouvoir')
  })

  // A numeric escape is a way to smuggle a tag past a naive stripper.
  it('does not let a numeric entity rebuild a tag', () => {
    const out = dek('&#60;script&#62;alert(1)&#60;/script&#62;Le vrai chapô.')
    expect(out).not.toContain('<')
    expect(out).toContain('Le vrai chapô.')
  })
})
