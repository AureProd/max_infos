import { inArray } from 'drizzle-orm'
import { SETTING_KEYS, SETTING_SCOPE } from '#shared/schemas/settings'
import { publicContact, publicCv } from '#shared/utils/public-profile'
import { useDatabase } from '~~/server/database/client'
import { media } from '~~/server/database/schema'
import { readSetting } from '~~/server/utils/settings'

/**
 * Collects everything that looks like `…MediaId` in the settings.
 *
 * A setting stores only an identifier: without resolution, the CV photo and
 * the downloadable PDF are just a number the browser cannot display. The
 * sweep is GENERIC, by field name, so that a future `bannerMediaId` gets
 * served without anyone having to think about it again.
 */
function mediaIds(value: unknown, found = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    for (const v of value) mediaIds(v, found)
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key.endsWith('MediaId') && typeof v === 'number') found.add(v)
      else mediaIds(v, found)
    }
  }
  return found
}

/**
 * Every setting of PUBLIC scope.
 *
 * The `scope` filter is the border between what Max configures and what
 * only JB sees. It is applied in SQL, not by filtering the response
 * afterwards: a missing filter on the JavaScript side would be invisible on
 * review, whereas here the query never brings back the technical settings.
 */
export default defineEventHandler(async () => {
  // The list of public keys comes from SETTING_SCOPE, not from what
  // happens to be in the database: a setting never saved returns its
  // default instead of being absent, and the site renders from the very
  // first install.
  const publicOnes = SETTING_KEYS.filter((key) => SETTING_SCOPE[key] === 'public')

  const output: Record<string, unknown> = {}
  for (const key of publicOnes) output[key] = await readSetting(key)

  // Public scope is not the whole story: inside `contact` and `cv`, each
  // field carries its own switch. Applying them here rather than in the
  // page is what keeps a hidden phone number out of the payload.
  output.contact = publicContact(output.contact as Parameters<typeof publicContact>[0])
  output.cv = publicCv(output.cv as Parameters<typeof publicCv>[0])

  const ids = [...mediaIds(output)]
  const files = ids.length
    ? await useDatabase()
        .select({ id: media.id, url: media.url, alt: media.alt, mime: media.mime })
        .from(media)
        .where(inArray(media.id, ids))
    : []

  // A table indexed by identifier rather than a list: the page reads
  // `mediaItems[cv.photoMediaId]` without having to search.
  return {
    ...output,
    mediaItems: Object.fromEntries(files.map((f) => [f.id, f])),
  }
})
