import { unfurlRequest } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { readOpenGraph } from '~~/server/utils/unfurl'

/**
 * Reads what a pasted link says about itself.
 *
 * Done SERVER-side, and not from the browser: the page being read sends no
 * CORS header, so the browser could not read the answer even when the
 * fetch succeeds.
 *
 * It never throws on the remote page's behalf. LinkedIn serves its
 * OpenGraph tags unevenly to crawlers; a refusal, a redirect to a login
 * page or a timeout all come back the same way — empty fields — and the
 * form stays there for Max to fill in. Failing would only turn a partial
 * convenience into a blocked screen.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { url } = await readValidatedBody(event, unfurlRequest.parse)

  const nothing = { title: '', description: '', image: '' }

  try {
    const html = await $fetch<string>(url, {
      responseType: 'text',
      // Ten seconds: past that, Max is better served by typing it himself.
      timeout: 10_000,
      redirect: 'follow',
      headers: {
        // Announcing a browser is what gets the OpenGraph tags served at
        // all: several networks answer a bare client with a login page.
        'user-agent':
          'Mozilla/5.0 (compatible; unmaxdinfo/1.0; +https://unmaxdinfo.fr) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    return typeof html === 'string' ? readOpenGraph(html) : nothing
  } catch {
    return nothing
  }
})
