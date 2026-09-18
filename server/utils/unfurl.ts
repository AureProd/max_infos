/**
 * What a page says about itself.
 *
 * No API will ever hand over a LinkedIn post: `r_member_social` is closed
 * to new applications, a constraint verified in September 2026 and not to
 * be relearnt. A post typed in by hand therefore arrived with neither title
 * nor image, and the card was bare.
 *
 * The OpenGraph tags a page serves to crawlers are the only thing left to
 * read. LinkedIn serves them unevenly — which is why nothing here throws:
 * an empty field is an honest answer, and the form stays editable.
 */

export interface OpenGraph {
  title: string
  description: string
  image: string
}

/** `&amp;`, `&#39;`, `&#x2014;` — entities are markup, not text. */
function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

/**
 * One `<meta>`, whatever the order of its attributes.
 *
 * LinkedIn writes `content` first. A pattern expecting `property` first
 * matches nothing — and says nothing about it.
 *
 * The value is read up to THE DELIMITER THAT OPENED IT, captured and
 * back-referenced. The obvious `["']([^"']*)["']` excludes both quote
 * characters whatever the opening one, so `content="L'enquête sur le
 * pouvoir"` stopped dead at the apostrophe: Max imported a post titled
 * « L ». In French titles an apostrophe is not an edge case, it is most of
 * them.
 */
function meta(html: string, names: readonly string[]): string {
  for (const name of names) {
    const escaped = name.replace(':', '\\:')
    // `(.*?)` reste non gourmand : il s'arrête au premier guillemet de la
    // même espèce, donc à la fin de l'attribut, jamais à la balise suivante.
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*(["'])(.*?)\\1`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content\\s*=\\s*(["'])(.*?)\\1[^>]*(?:property|name)\\s*=\\s*["']${escaped}["']`,
        'i',
      ),
    ]
    for (const pattern of patterns) {
      const hit = pattern.exec(html)
      if (hit?.[2]) return decode(hit[2])
    }
  }
  return ''
}

export function readOpenGraph(html: string): OpenGraph {
  const title =
    meta(html, ['og:title', 'twitter:title']) ||
    decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')

  const image = meta(html, ['og:image', 'og:image:secure_url', 'twitter:image'])

  return {
    title,
    description: meta(html, ['og:description', 'twitter:description', 'description']),
    // A relative address would not load on our page: better nothing than a
    // broken image.
    image: /^https?:\/\//i.test(image) ? image : '',
  }
}

/**
 * Ce que le serveur accepte d'aller chercher.
 *
 * Le dépliage fait faire une requête AU SERVEUR depuis une adresse que
 * l'utilisateur écrit. Sans garde, un éditeur pouvait lui faire interroger
 * le réseau interne du déploiement — la base sur `db:5432`, le tableau de
 * bord de Traefik, l'API de métadonnées d'un fournisseur de VPS sur
 * 169.254.169.254 — et lire dans la réponse ce qu'un `<title>` en dit.
 *
 * Liste BLANCHE de schémas, liste noire d'hôtes. Le filtre porte sur ce que
 * l'adresse déclare : il ne résout pas le nom, donc un domaine public qui
 * pointe vers une adresse privée passe encore. Ce qu'il arrête, c'est
 * l'adresse interne écrite en clair — le cas réel, et le seul qu'un
 * contrôle synchrone puisse arrêter sans course entre la vérification et
 * la requête.
 */
export function isFetchableUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  // `new URL` garde les crochets d'une adresse IPv6 : on les retire pour
  // comparer, sans quoi `[::1]` ne ressemble à rien de connu.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return false

  if (host === 'localhost' || host.endsWith('.localhost')) return false

  // Un nom de SERVICE n'a pas de point : `db`, `app`, `traefik`. Tout nom
  // du web public en a au moins un.
  // Une IPv6 porte des deux-points, une IPv4 n'a que des chiffres et des
  // points. La classe hexadécimale attrapait « db » — `d` et `b` en sont —
  // et le nom du conteneur de base passait pour une adresse.
  const looksLikeIp = host.includes(':') || /^[0-9.]+$/.test(host)
  if (!looksLikeIp && !host.includes('.')) return false

  if (host.includes(':')) {
    // IPv6 : boucle locale, lien-local (fe80::/10) et unique-local (fc00::/7).
    if (host === '::' || host === '::1') return false
    if (/^f[cd][0-9a-f]{2}:/i.test(host)) return false
    if (/^fe[89ab][0-9a-f]:/i.test(host)) return false
    return true
  }

  if (/^[0-9.]+$/.test(host)) {
    /*
     * `http://127.1` est une adresse VALIDE pour le résolveur : les formes
     * courtes complètent les octets manquants. Une comparaison textuelle
     * sur « 127.0.0.1 » passait à côté.
     */
    const parts = host.split('.').map(Number)
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
    const [a = 0, b = 0] = parts.length === 4 ? parts : [parts[0] ?? 0, 0]
    if (a === 0 || a === 127) return false
    if (a === 10) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    // Lien-local, dont l'API de métadonnées des fournisseurs de VPS.
    if (a === 169 && b === 254) return false
  }

  return true
}

/** Ce qu'on accepte de lire d'une page : au-delà, ce n'est plus une page. */
const MAX_BYTES = 512 * 1024

/**
 * Va chercher le HTML d'une page, en tenant le garde à CHAQUE saut.
 *
 * Suivre les redirections automatiquement contournait `isFetchableUrl` :
 * une page publique qui renvoie vers `http://169.254.169.254/` fait
 * repartir la requête sans repasser par lui. Les refuser toutes aurait
 * cassé le dépliage — LinkedIn et Substack redirigent tous les deux. Elles
 * sont donc suivies à la main, trois au plus, chacune vérifiée.
 *
 * La lecture est BORNÉE : une réponse de plusieurs gigaoctets aurait été
 * mise en mémoire en entier avant qu'on n'y cherche une balise `<meta>`.
 *
 * `allow` est injectable pour que le test puisse exercer les sauts et la
 * borne contre un serveur local — que le garde refuse, à raison.
 */
export async function fetchPageHtml(
  start: string,
  options: { allow?: (url: string) => boolean; hops?: number; signal?: AbortSignal } = {},
): Promise<string | null> {
  const allow = options.allow ?? isFetchableUrl
  let url = start

  for (let hop = 0; hop <= (options.hops ?? 3); hop++) {
    if (!allow(url)) return null

    const response = await fetch(url, {
      redirect: 'manual',
      signal: options.signal,
      headers: {
        // Announcing a browser is what gets the OpenGraph tags served at
        // all: several networks answer a bare client with a login page.
        'user-agent':
          'Mozilla/5.0 (compatible; unmaxdinfo/1.0; +https://unmaxdinfo.fr) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      // Une redirection relative est légale : elle se résout sur l'adresse
      // courante, et repasse par le garde comme les autres.
      url = new URL(location, url).toString()
      continue
    }

    if (!response.ok || !response.body) return null

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let read = 0
    while (read < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      read += value.length
    }
    await reader.cancel().catch(() => {})

    return new TextDecoder().decode(
      chunks.reduce((all, chunk) => {
        const next = new Uint8Array(all.length + chunk.length)
        next.set(all)
        next.set(chunk, all.length)
        return next
      }, new Uint8Array()),
    )
  }

  // Trop de sauts : une page qui redirige quatre fois ne dit rien d'elle.
  return null
}
