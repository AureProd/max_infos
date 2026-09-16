import { substackImport } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { readSetting, writeSetting } from '~~/server/utils/settings'
import { checkedFeedUrl, importSubstack } from '~~/server/utils/substack-import'

/**
 * Repatriates the Substack publication. Role `editor`.
 *
 * Max's publication, Max's screen. What it writes are DRAFTS — the
 * conversion is reviewed before anything is published — so nothing here can
 * put unread markup in front of readers.
 *
 * The address is checked BEFORE the fetch: the server is the one making the
 * request, and an unchecked address turns the site into a probe for the
 * VPS's own network.
 */
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'editor')
  const { feedUrl, dryRun } = await readValidatedBody(event, substackImport.parse)

  const saved = (await readSetting('substack')).feedUrl
  const url = checkedFeedUrl(feedUrl ?? saved)

  // Remembered only once it has been checked, so that a refused address is
  // never written down.
  if (url !== saved) await writeSetting('substack', { feedUrl: url }, user.id)

  const response = await fetch(url, { headers: { accept: 'application/rss+xml' } })
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Le flux Substack a répondu ${response.status}`,
      // `message` and not `statusMessage` alone: h3 strips every non-ASCII
      // character from the status line, and in HTTP/2 there is no status line
      // at all — the accented French text reached the browser mangled, or
      // empty.
      message: `Le flux Substack a répondu ${response.status}`,
    })
  }

  return await importSubstack(await response.text(), { dryRun })
})
