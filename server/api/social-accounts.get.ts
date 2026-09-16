import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { socialAccount, socialPost } from '~~/server/database/schema'
import { iso } from '~~/server/utils/serialize'

/**
 * The accounts shown on the home page, each with its latest posts.
 *
 * One section per account: this response is what draws it. The label, the
 * picture and the counters come from the account as Instagram gives it —
 * nothing is typed in by hand, so nothing can stay wrong for long.
 *
 * The columns are listed one by one: neither the token nor `raw`, Meta's
 * payload, must be able to slip out by accident.
 */
export default defineEventHandler(async () => {
  const db = useDatabase()

  const accounts = await db
    .select({
      id: socialAccount.id,
      username: socialAccount.username,
      displayName: socialAccount.displayName,
      biography: socialAccount.biography,
      avatarUrl: socialAccount.avatarUrl,
      followers: socialAccount.followers,
      mediaCount: socialAccount.mediaCount,
      postsOnHome: socialAccount.postsOnHome,
    })
    .from(socialAccount)
    .where(and(eq(socialAccount.network, 'instagram'), eq(socialAccount.visible, true)))
    .orderBy(asc(socialAccount.position), asc(socialAccount.id))

  if (accounts.length === 0) return []

  // A single query for every section, and the hidden-post filter IN SQL.
  // Truncating to `postsOnHome` happens afterwards: that is a display
  // decision, over a few dozen rows.
  const publications = await db
    .select({
      id: socialPost.id,
      accountId: socialPost.accountId,
      network: socialPost.network,
      url: socialPost.url,
      shortcode: socialPost.shortcode,
      mediaType: socialPost.mediaType,
      caption: socialPost.caption,
      thumbnailUrl: socialPost.thumbnailUrl,
      mediaUrl: socialPost.mediaUrl,
      permalink: socialPost.permalink,
      postedAt: socialPost.postedAt,
    })
    .from(socialPost)
    .where(
      and(
        eq(socialPost.hidden, false),
        inArray(
          socialPost.accountId,
          accounts.map((c) => c.id),
        ),
      ),
    )
    .orderBy(desc(socialPost.postedAt))

  return accounts.map(({ postsOnHome, ...account }) => ({
    ...account,
    url: account.username ? `https://www.instagram.com/${account.username}` : null,
    publications: publications
      .filter((p) => p.accountId === account.id)
      .slice(0, postsOnHome)
      .map(({ accountId: _accountId, ...p }) => ({ ...p, postedAt: iso(p.postedAt) })),
  }))
})
