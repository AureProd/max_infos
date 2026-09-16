import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { secret, socialAccount, socialPost } from '~~/server/database/schema'
import { decrypt, encrypt } from './crypto'

/**
 * Instagram integration — READ ONLY.
 *
 * The site never publishes. It discovers Max's posts, displays them, and
 * helps him write. That is a project decision, not a technical limit.
 *
 * Constraints already verified, not to be learnt twice: the Basic Display
 * API has been closed since late 2024; the path that works is the Instagram
 * API with Instagram Login, which does NOT require a Facebook page since
 * July 2024; the long-lived token lasts 60 days and refreshes as long as it
 * is used.
 */

const BASE = 'https://graph.instagram.com'

/**
 * The token key, DERIVED FROM THE ACCOUNT.
 *
 * There was a single key as long as there was a single account. With
 * several, one shared key would mean the last account connected overwrites
 * the previous one's token — no error, no trace, and the older account
 * would simply stop syncing.
 */
export const tokenKey = (accountId: number): string => `instagram_access_token:${accountId}`

/**
 * The HTTP client, injectable.
 *
 * A narrow type rather than `typeof $fetch`: the latter carries Nitro's
 * route inference, which blows up (« Excessive stack depth ») as soon as it
 * is used as a parameter default. Incidentally, this type says exactly what
 * this module needs — and makes injecting a stub client obvious in tests.
 */
export type HttpClient = <T>(
  url: string,
  options?: { query?: Record<string, string> },
) => Promise<T>

const defaultClient: HttpClient = (url, options) =>
  $fetch(url, options as Record<string, unknown>) as never

export interface InstagramMedia {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: 'FEED' | 'REELS' | 'STORY'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  caption?: string
  timestamp: string
}

interface MediaPage {
  data: InstagramMedia[]
  paging?: { next?: string }
}

export interface InstagramProfile {
  id: string
  username: string
  name?: string
  biography?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

/** Translates Meta's vocabulary into ours. */
export function mediaType(m: InstagramMedia): 'reel' | 'carousel' | 'image' | 'post' {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'IMAGE') return 'image'
  return 'post'
}

/** The shortcode, taken from the permalink: instagram.com/p/ABC123/ → ABC123 */
export function shortcodeOf(permalink: string): string | null {
  return permalink.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

export async function readToken(accountId: number): Promise<string | null> {
  const [row] = await useDatabase()
    .select({ ciphertext: secret.ciphertext })
    .from(secret)
    .where(eq(secret.key, tokenKey(accountId)))
    .limit(1)
  return row ? decrypt(row.ciphertext) : null
}

export async function saveToken(accountId: number, token: string): Promise<void> {
  const ciphertext = encrypt(token)
  await useDatabase()
    .insert(secret)
    .values({ key: tokenKey(accountId), ciphertext })
    .onConflictDoUpdate({ target: secret.key, set: { ciphertext, updatedAt: new Date() } })
}

/** Disconnecting an account means forgetting its token first. */
export async function removeToken(accountId: number): Promise<void> {
  await useDatabase()
    .delete(secret)
    .where(eq(secret.key, tokenKey(accountId)))
}

/**
 * Refreshes the long-lived token.
 *
 * To be done BEFORE expiry: an expired token cannot be refreshed any more,
 * the OAuth dance has to be redone by hand. Hence the daily task.
 */
export async function refreshToken(
  token: string,
  http: HttpClient = defaultClient,
): Promise<{ access_token: string; expires_in: number }> {
  return await http<{ access_token: string; expires_in: number }>(`${BASE}/refresh_access_token`, {
    query: { grant_type: 'ig_refresh_token', access_token: token },
  })
}

export async function readProfile(
  token: string,
  http: HttpClient = defaultClient,
): Promise<InstagramProfile> {
  return await http<InstagramProfile>(`${BASE}/me`, {
    query: {
      fields: 'id,username,name,biography,profile_picture_url,followers_count,media_count',
      access_token: token,
    },
  })
}

/**
 * Every post, following the pagination.
 *
 * Capped at 20 pages: without that, a pagination that loops — or a huge
 * account — would keep the sync running forever.
 */
export async function readMedia(
  token: string,
  http: HttpClient = defaultClient,
  maxPages = 20,
): Promise<InstagramMedia[]> {
  const fields =
    'id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp'
  const all: InstagramMedia[] = []

  let url = `${BASE}/me/media`
  let query: Record<string, string> | undefined = {
    fields: fields,
    access_token: token,
    limit: '50',
  }
  let again = true

  for (let page = 0; page < maxPages && again; page++) {
    const response = await http<MediaPage>(url, { query })
    all.push(...(response.data ?? []))
    const next = response.paging?.next
    if (next) {
      url = next
      // The « next » URL already carries its parameters.
      query = undefined
    } else {
      again = false
    }
  }

  return all
}

/**
 * Writes the posts to the database, never duplicating.
 *
 * Idempotence rests on the unique index (network, external_id): replaying a
 * sync updates instead of inserting. `hidden` and `position` are NOT
 * touched on update — they are Max's decisions, and a sync has no business
 * undoing them.
 */
export async function syncPosts(
  mediaItems: InstagramMedia[],
  accountId: number,
): Promise<{ views: number; fresh: number }> {
  const db = useDatabase()
  let fresh = 0

  for (const m of mediaItems) {
    const [before] = await db
      .select({ id: socialPost.id })
      .from(socialPost)
      .where(eq(socialPost.externalId, m.id))
      .limit(1)

    await db
      .insert(socialPost)
      .values({
        network: 'instagram',
        accountId: accountId,
        externalId: m.id,
        shortcode: shortcodeOf(m.permalink),
        url: m.permalink,
        permalink: m.permalink,
        mediaType: mediaType(m),
        caption: m.caption ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        // The file itself, kept apart: for a video, thumbnail_url is only
        // the poster frame, and dropping media_url meant a reel could never
        // be shown as anything but a still image.
        mediaUrl: m.media_url ?? null,
        postedAt: new Date(m.timestamp),
        source: 'api',
        raw: m as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [socialPost.network, socialPost.externalId],
        set: {
          // accountId is carried over: an already known post reappearing
          // under another account files itself where it now belongs.
          accountId: accountId,
          caption: m.caption ?? null,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
          // Refreshed on every sync: these CDN addresses expire.
          mediaUrl: m.media_url ?? null,
          permalink: m.permalink,
          mediaType: mediaType(m),
          raw: m as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })

    if (!before) fresh++
  }

  return { views: mediaItems.length, fresh }
}

/**
 * Saves the account from the Meta profile, and returns its id.
 *
 * The displayed identity ALWAYS comes from here: Max does not type it in,
 * and a correction made on Instagram flows back on its own. `visible`,
 * `position` and `postsOnHome`, on the other hand, are NOT touched — they
 * are his decisions, and a sync has no business undoing them, exactly like
 * `hidden` and `position` on posts.
 */
export async function saveAccount(profile: InstagramProfile): Promise<number> {
  const identity = {
    username: profile.username,
    displayName: profile.name ?? null,
    biography: profile.biography ?? null,
    avatarUrl: profile.profile_picture_url ?? null,
    followers: profile.followers_count ?? null,
    mediaCount: profile.media_count ?? null,
    lastSyncAt: new Date(),
  }

  const [row] = await useDatabase()
    .insert(socialAccount)
    .values({ network: 'instagram', externalId: profile.id, ...identity })
    .onConflictDoUpdate({
      target: [socialAccount.network, socialAccount.externalId],
      set: { ...identity, updatedAt: new Date() },
    })
    .returning({ id: socialAccount.id })

  if (!row) throw new Error("Le compte Instagram n'a pas pu être enregistré")
  return row.id
}

/**
 * The accounts to sync — hidden ones INCLUDED.
 *
 * Hiding an account is a display decision, not a broken connection: showing
 * it again must reveal up-to-date posts, not a gap the size of how long it
 * stayed hidden.
 */
export async function instagramAccounts() {
  return await useDatabase()
    .select({
      id: socialAccount.id,
      externalId: socialAccount.externalId,
      username: socialAccount.username,
    })
    .from(socialAccount)
    .where(eq(socialAccount.network, 'instagram'))
    .orderBy(socialAccount.position, socialAccount.id)
}

/**
 * The OAuth exchange, in two steps imposed by Meta.
 *
 * The authorization code yields a SHORT-lived token (one hour), unusable as
 * is: it must be exchanged immediately for a long-lived one (60 days), the
 * only refreshable kind. Forgetting the second exchange gives an
 * integration that works for an hour then dies without a clear message —
 * the classic trap of this API.
 */
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'

/** The URL to send Max to so he can authorize the application. */
export function authorizationUrl(appId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    // Read only: the site never publishes, so it never asks for the
    // permission to publish.
    scope: 'instagram_business_basic',
    response_type: 'code',
    state: state,
  })
  return `https://www.instagram.com/oauth/authorize?${q}`
}

export async function exchangeCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
  http: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  // Form and not JSON: this one Meta endpoint refuses application/json,
  // and says so only through a 400.
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const response = await http(OAUTH_TOKEN_URL, { method: 'POST', body: body })
  if (!response.ok) throw new Error(`Instagram a refusé le code (${response.status})`)
  const short = (await response.json()) as { access_token?: string }
  if (!short.access_token) throw new Error("Instagram n'a pas renvoyé de jeton")
  return short.access_token
}

/** The second exchange: short-lived token → long-lived one, the only one that counts. */
export async function extendToken(
  shortToken: string,
  appSecret: string,
  http: HttpClient = defaultClient,
): Promise<string> {
  const long = await http<{ access_token: string }>(`${BASE}/access_token`, {
    query: {
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken,
    },
  })
  return long.access_token
}

/**
 * The redirect URI, DERIVED from the public URL.
 *
 * It must match the one declared at Meta character for character. Deriving
 * it from a single source avoids the most common mismatch — one trailing
 * slash of difference, and the exchange fails on a message that does not
 * say why.
 */
export function redirectUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/admin/instagram/callback`
}
