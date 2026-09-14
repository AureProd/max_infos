import { eq } from 'drizzle-orm'
import { useBase } from '~~/server/database/client'
import { secret, setting, socialPost } from '~~/server/database/schema'
import { chiffrer, dechiffrer } from './crypto'

/**
 * Intégration Instagram — LECTURE SEULE.
 *
 * Le site ne publie jamais. Il découvre les publications de Max, les
 * affiche, et l'aide à rédiger. C'est une décision du projet, pas une
 * limite technique.
 *
 * Contraintes vérifiées, à ne pas réapprendre : l'API Basic Display est
 * fermée depuis fin 2024 ; la voie qui fonctionne est l'Instagram API with
 * Instagram Login, qui n'exige PAS de page Facebook depuis juillet 2024 ;
 * le jeton longue durée vaut 60 jours et se rafraîchit tant qu'il sert.
 */

const BASE = 'https://graph.instagram.com'
const CLE_JETON = 'instagram_access_token'

/**
 * Le client HTTP, injectable.
 *
 * Type étroit et non `typeof $fetch` : ce dernier porte l'inférence des
 * routes de Nitro, qui sature (« Excessive stack depth ») dès qu'on
 * l'emploie comme valeur par défaut d'un paramètre. Accessoirement, ce type
 * dit exactement ce dont ce module a besoin — et rend l'injection d'un
 * client simulé évidente dans les tests.
 */
export type ClientHttp = <T>(
  url: string,
  options?: { query?: Record<string, string> },
) => Promise<T>

const clientParDefaut: ClientHttp = (url, options) =>
  $fetch(url, options as Record<string, unknown>) as never

export interface MediaInstagram {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type?: 'FEED' | 'REELS' | 'STORY'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  caption?: string
  timestamp: string
}

interface PageMedias {
  data: MediaInstagram[]
  paging?: { next?: string }
}

export interface ProfilInstagram {
  id: string
  username: string
  name?: string
  biography?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

/** Traduit le vocabulaire de Meta vers le nôtre. */
export function typeDeMedia(m: MediaInstagram): 'reel' | 'carousel' | 'image' | 'post' {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'IMAGE') return 'image'
  return 'post'
}

/** Le code court, extrait du permalien : instagram.com/p/ABC123/ → ABC123 */
export function shortcodeDe(permalink: string): string | null {
  return permalink.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

export async function lireJeton(): Promise<string | null> {
  const [ligne] = await useBase()
    .select({ ciphertext: secret.ciphertext })
    .from(secret)
    .where(eq(secret.key, CLE_JETON))
    .limit(1)
  return ligne ? dechiffrer(ligne.ciphertext) : null
}

export async function enregistrerJeton(jeton: string): Promise<void> {
  const ciphertext = chiffrer(jeton)
  await useBase()
    .insert(secret)
    .values({ key: CLE_JETON, ciphertext })
    .onConflictDoUpdate({ target: secret.key, set: { ciphertext, updatedAt: new Date() } })
}

/**
 * Rafraîchit le jeton longue durée.
 *
 * À faire AVANT l'expiration : un jeton périmé ne se rafraîchit plus, il
 * faut refaire l'OAuth à la main. D'où la tâche quotidienne.
 */
export async function rafraichirJeton(
  jeton: string,
  http: ClientHttp = clientParDefaut,
): Promise<{ access_token: string; expires_in: number }> {
  return await http<{ access_token: string; expires_in: number }>(`${BASE}/refresh_access_token`, {
    query: { grant_type: 'ig_refresh_token', access_token: jeton },
  })
}

export async function lireProfil(
  jeton: string,
  http: ClientHttp = clientParDefaut,
): Promise<ProfilInstagram> {
  return await http<ProfilInstagram>(`${BASE}/me`, {
    query: {
      fields: 'id,username,name,biography,profile_picture_url,followers_count,media_count',
      access_token: jeton,
    },
  })
}

/**
 * Toutes les publications, en suivant la pagination.
 *
 * Bornée à 20 pages : sans cela, une pagination qui boucle — ou un compte
 * énorme — ferait tourner la synchronisation indéfiniment.
 */
export async function lireMedias(
  jeton: string,
  http: ClientHttp = clientParDefaut,
  maxPages = 20,
): Promise<MediaInstagram[]> {
  const champs =
    'id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp'
  const tout: MediaInstagram[] = []

  let url = `${BASE}/me/media`
  let query: Record<string, string> | undefined = {
    fields: champs,
    access_token: jeton,
    limit: '50',
  }
  let encore = true

  for (let page = 0; page < maxPages && encore; page++) {
    const reponse = await http<PageMedias>(url, { query })
    tout.push(...(reponse.data ?? []))
    const suivante = reponse.paging?.next
    if (suivante) {
      url = suivante
      // L'URL « next » porte déjà ses paramètres.
      query = undefined
    } else {
      encore = false
    }
  }

  return tout
}

/**
 * Écrit les publications en base, sans jamais dupliquer.
 *
 * L'idempotence tient à l'index unique (network, external_id) : rejouer une
 * synchronisation met à jour au lieu d'insérer. `hidden` et `position` ne
 * sont PAS touchés à la mise à jour — ce sont des décisions de Max, que la
 * synchronisation n'a pas à défaire.
 */
export async function synchroniser(
  medias: MediaInstagram[],
): Promise<{ vues: number; nouvelles: number }> {
  const db = useBase()
  let nouvelles = 0

  for (const m of medias) {
    const [avant] = await db
      .select({ id: socialPost.id })
      .from(socialPost)
      .where(eq(socialPost.externalId, m.id))
      .limit(1)

    await db
      .insert(socialPost)
      .values({
        network: 'instagram',
        externalId: m.id,
        shortcode: shortcodeDe(m.permalink),
        url: m.permalink,
        permalink: m.permalink,
        mediaType: typeDeMedia(m),
        caption: m.caption ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        postedAt: new Date(m.timestamp),
        source: 'api',
        raw: m as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [socialPost.network, socialPost.externalId],
        set: {
          caption: m.caption ?? null,
          thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
          permalink: m.permalink,
          mediaType: typeDeMedia(m),
          raw: m as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })

    if (!avant) nouvelles++
  }

  return { vues: medias.length, nouvelles }
}

/** Enregistre le profil dans `setting`, portée publique. Fin des chiffres inventés. */
export async function enregistrerProfil(profil: ProfilInstagram): Promise<void> {
  const valeur = {
    handle: `@${profil.username}`,
    url: `https://www.instagram.com/${profil.username}`,
    name: profil.name ?? null,
    biography: profil.biography ?? null,
    avatar: profil.profile_picture_url ?? null,
    followers: profil.followers_count ?? null,
    posts: profil.media_count ?? null,
    syncAt: new Date().toISOString(),
  }
  await useBase()
    .insert(setting)
    .values({ key: 'instagram_public', value: valeur, scope: 'public' })
    .onConflictDoUpdate({ target: setting.key, set: { value: valeur, updatedAt: new Date() } })
}

/**
 * L'échange OAuth, en deux temps imposés par Meta.
 *
 * Le code d'autorisation donne un jeton COURT (une heure), inutilisable
 * tel quel : il faut immédiatement l'échanger contre un jeton long
 * (60 jours), seul rafraîchissable. Oublier le second échange donne une
 * intégration qui marche une heure puis meurt sans message clair — c'est
 * le piège classique de cette API.
 */
const OAUTH_JETON = 'https://api.instagram.com/oauth/access_token'

/** L'URL vers laquelle envoyer Max pour qu'il autorise l'application. */
export function urlAutorisation(appId: string, redirection: string, etat: string): string {
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirection,
    // Lecture seule : le site ne publie jamais, il ne demande donc jamais
    // la permission de publier.
    scope: 'instagram_business_basic',
    response_type: 'code',
    state: etat,
  })
  return `https://www.instagram.com/oauth/authorize?${q}`
}

export async function echangerCode(
  code: string,
  appId: string,
  appSecret: string,
  redirection: string,
  http: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  // Formulaire et non JSON : cet unique point d'entrée de Meta refuse
  // l'application/json, sans le dire autrement que par un 400.
  const corps = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirection,
    code,
  })
  const reponse = await http(OAUTH_JETON, { method: 'POST', body: corps })
  if (!reponse.ok) throw new Error(`Instagram a refusé le code (${reponse.status})`)
  const court = (await reponse.json()) as { access_token?: string }
  if (!court.access_token) throw new Error("Instagram n'a pas renvoyé de jeton")
  return court.access_token
}

/** Le second échange : jeton court → jeton long, le seul qui vaille. */
export async function allongerJeton(
  jetonCourt: string,
  appSecret: string,
  http: ClientHttp = clientParDefaut,
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
export function urlDeRedirection(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/admin/instagram/callback`
}
