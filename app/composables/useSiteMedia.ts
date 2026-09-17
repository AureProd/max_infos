import type { MediaPublic, SitePublic } from '#shared/types/site'

/**
 * Turning a media id from the settings into something displayable.
 *
 * `/api/site` hands out the ids (`cv.photoMediaId`, `cv.pdfMediaId`,
 * `seo.imageMediaId`) and, separately, a `mediaItems` dictionary. Each page
 * did the lookup itself, and the same four lines were about to be written a
 * third time for the author's portrait on an article.
 *
 * Reads the shared `site` payload rather than fetching: the masthead has
 * already asked for it, and `useFetch`'s key makes the answer common to
 * every caller.
 */
export function useSiteMedia() {
  const { data: site } = useNuxtData<SitePublic>('site')

  return (id: number | null | undefined): MediaPublic | null =>
    id ? (site.value?.mediaItems?.[id] ?? null) : null
}
