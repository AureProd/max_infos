/**
 * Invalidating the cache of the public pages.
 *
 * The public routes are served by `swr` (see routeRules in nuxt.config.ts):
 * the last rendered version is handed out while a new one is prepared. The
 * gain is real — the database is queried once per period rather than once
 * per visitor, and a momentarily unavailable database no longer brings the
 * site down.
 *
 * The cost, until now, was a back-office that lied: Max saved a change and
 * the site kept serving the old page. For five minutes on the home page,
 * TEN minutes on an article, and a full HOUR on /about — which is where the
 * CV is. He would re-save, reload, and conclude the save had failed.
 *
 * So every write that changes what a visitor sees clears this cache. The
 * site keeps its resilience, and the back-office tells the truth.
 */

/** The prefix under which Nitro files its rendered routes. */
const ROUTE_CACHE = 'nitro:routes'

export async function invalidatePublicCache(): Promise<void> {
  try {
    const cache = useStorage('cache')
    const keys = await cache.getKeys(ROUTE_CACHE)
    await Promise.all(keys.map((key) => cache.removeItem(key)))
  } catch {
    // The save has ALREADY happened. A cache that cannot be cleared must
    // never turn a successful publication into a 500 — at worst the visitor
    // sees the previous version for a few more minutes.
  }
}
