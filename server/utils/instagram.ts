import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/database/client'
import { secret, socialAccount, socialPost } from '~~/server/database/schema'
import { decrypt, encrypt } from './crypto'

/**
 * Intégration Instagram — LECTURE SEULE.
 *
 * Le site ne publie jamais. Il découvre les publications de Max, les
 * affiche, et l'aide à rédiger. C'est une décision du projet, pas une
 * limite technique.
 *
 * Contraintes vérifiées, à ne pas réapprendre : l'API Basic Display est
 * fermée since fin 2024 ; la voie qui fonctionne est l'Instagram API with
 * Instagram Login, qui n'exige PAS de page Facebook since juillet 2024 ;
 * le token longue durée vaut 60 jours et se rafraîchit tant qu'il sert.
 */

const BASE = 'https://graph.instagram.com'

/**
 * La clé du token, DÉRIVÉE DU COMPTE.
 *
 * Il n'y avait qu'une clé tant qu'il n'y avait qu'un account. Avec plusieurs,
 * une clé unique ferait que le dernier account connecté écraserait le token du
 * précédent — sans error, sans trace, et l'ancien account cesserait de se
 * syncPosts.
 */
export const tokenKey = (compteId: number): string => `instagram_access_token:${compteId}`

/**
 * Le client HTTP, injectable.
 *
 * Type étroit et non `typeof $fetch` : ce dernier porte l'inférence des
 * routes de Nitro, qui sature (« Excessive stack depth ») dès qu'on
 * l'emploie comme value par défaut d'un paramètre. Accessoirement, ce type
 * dit exactement ce dont ce module a besoin — et rend l'injection d'un
 * client simulé évidente dans les tests.
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

/** Traduit le vocabulaire de Meta vers le nôtre. */
export function mediaType(m: InstagramMedia): 'reel' | 'carousel' | 'image' | 'post' {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'IMAGE') return 'image'
  return 'post'
}

/** Le code short, extrait du permalien : instagram.com/p/ABC123/ → ABC123 */
export function shortcodeOf(permalink: string): string | null {
  return permalink.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

export async function readToken(compteId: number): Promise<string | null> {
  const [ligne] = await useDatabase()
    .select({ ciphertext: secret.ciphertext })
    .from(secret)
    .where(eq(secret.key, tokenKey(compteId)))
    .limit(1)
  return ligne ? decrypt(ligne.ciphertext) : null
}

export async function saveToken(compteId: number, token: string): Promise<void> {
  const ciphertext = encrypt(token)
  await useDatabase()
    .insert(secret)
    .values({ key: tokenKey(compteId), ciphertext })
    .onConflictDoUpdate({ target: secret.key, set: { ciphertext, updatedAt: new Date() } })
}

/** Déconnecter un account, c'est d'abord oublier son token. */
export async function removeToken(compteId: number): Promise<void> {
  await useDatabase()
    .delete(secret)
    .where(eq(secret.key, tokenKey(compteId)))
}

/**
 * Rafraîchit le token longue durée.
 *
 * À faire AVANT l'expiration : un token périmé ne se rafraîchit plus, il
 * faut refaire l'OAuth à la main. D'où la tâche quotidienne.
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
 * Toutes les publications, en suivant la pagination.
 *
 * Bornée à 20 pages : sans cela, une pagination qui boucle — ou un account
 * énorme — ferait tourner la synchronisation indéfiniment.
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
      // L'URL « next » porte déjà ses paramètres.
      query = undefined
    } else {
      again = false
    }
  }

  return all
}

/**
 * Écrit les publications en base, sans jamais dupliquer.
 *
 * L'idempotence tient à l'index unique (network, external_id) : rejouer une
 * synchronisation met à day au lieu d'insérer. `hidden` et `position` ne
 * sont PAS touchés à la mise à day — ce sont des décisions de Max, que la
 * synchronisation n'a pas à défaire.
 */
export async function syncPosts(
  mediaItems: InstagramMedia[],
  compteId: number,
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
        accountId: compteId,
        externalId: m.id,
        shortcode: shortcodeOf(m.permalink),
        url: m.permalink,
        permalink: m.permalink,
        mediaType: mediaType(m),
        caption: m.caption ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        postedAt: new Date(m.timestamp),
        source: 'api',
        raw: m as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [socialPost.network, socialPost.externalId],
        set: {
          // accountId est repris : une publication déjà connue qui
          // réapparaît sous un autre account se range là où elle est.
          accountId: compteId,
          caption: m.caption ?? null,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
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
 * Enregistre le account à partir du profile Meta, et renvoie son identifiant.
 *
 * L'identité affichée vient TOUJOURS d'here : Max ne la saisit pas, et une
 * correction faite sur Instagram remonte d'elle-même. En revanche `visible`,
 * `position` et `postsOnHome` ne sont PAS touchés — ce sont ses décisions, et
 * une synchronisation n'a pas à les défaire, exactement comme `hidden` et
 * `position` sur les publications.
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

  const [ligne] = await useDatabase()
    .insert(socialAccount)
    .values({ network: 'instagram', externalId: profile.id, ...identity })
    .onConflictDoUpdate({
      target: [socialAccount.network, socialAccount.externalId],
      set: { ...identity, updatedAt: new Date() },
    })
    .returning({ id: socialAccount.id })

  if (!ligne) throw new Error("Le compte Instagram n'a pas pu être enregistré")
  return ligne.id
}

/**
 * Les accounts à syncPosts — masqués COMPRIS.
 *
 * Masquer un account est une décision d'affichage, pas une rupture de la
 * connection : le réafficher doit montrer des publications à day, pas un trou
 * correspondant à la durée du masquage.
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
 * L'échange OAuth, en two temps imposés par Meta.
 *
 * Le code d'autorisation donne un token COURT (une heure), inutilisable
 * tel quel : il faut immédiatement l'échanger contre un token long
 * (60 jours), seul rafraîchissable. Oublier le second échange donne une
 * intégration qui marche une heure then meurt sans message clair — c'est
 * le piège classique de cette API.
 */
const OAUTH_JETON = 'https://api.instagram.com/oauth/access_token'

/** L'URL vers laquelle envoyer Max pour qu'il autorise l'application. */
export function authorizationUrl(appId: string, redirection: string, state: string): string {
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirection,
    // Lecture seule : le site ne publie jamais, il ne request donc jamais
    // la permission de publier.
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
  redirection: string,
  http: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  // Formulaire et non JSON : cet unique point d'entrée de Meta refuse
  // l'application/json, sans le dire autrement que par un 400.
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirection,
    code,
  })
  const response = await http(OAUTH_JETON, { method: 'POST', body: body })
  if (!response.ok) throw new Error(`Instagram a refusé le code (${response.status})`)
  const short = (await response.json()) as { access_token?: string }
  if (!short.access_token) throw new Error("Instagram n'a pas renvoyé de jeton")
  return short.access_token
}

/** Le second échange : token short → token long, le seul qui vaille. */
export async function extendToken(
  jetonCourt: string,
  appSecret: string,
  http: HttpClient = defaultClient,
): Promise<string> {
  const long = await http<{ access_token: string }>(`${BASE}/access_token`, {
    query: {
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: jetonCourt,
    },
  })
  return long.access_token
}

/**
 * L'URI de redirection, DÉDUITE de l'URL publique.
 *
 * Elle doit correspondre au caractère près à celle déclarée chez Meta. La
 * déduire d'une seule source évite l'écart le plus fréquent — une barre
 * oblique finale de différence, et l'échange échoue sur un message qui ne
 * dit pas pourquoi.
 */
export function redirectUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/admin/instagram/callback`
}
