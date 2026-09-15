import type { SitePublic } from '#shared/types/site'

/**
 * The site's public settings, loaded ONCE and shared.
 *
 * The key passed to `useFetch` is what makes that sharing possible:
 * masthead, footer, home page and « about » page all call this composable,
 * but the request is made once, and its result is serialised from server to
 * client along with the render — so no browser call on first load.
 */
export function useSite() {
  return useFetch<SitePublic>('/api/site', { key: 'site' })
}
