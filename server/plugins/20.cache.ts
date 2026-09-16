import { invalidatePublicCache } from '../utils/cache'

/**
 * Clears the public cache after every back-office write.
 *
 * ONE hook rather than a call in each of the fourteen writing routes: a
 * route added tomorrow is covered without anyone having to remember. The
 * same reasoning as the `scope: 'tech'` filter being in SQL — an omission
 * must be impossible, not merely unlikely.
 *
 * Two exclusions, and they matter:
 *  - `preview` is called on every keystroke while Max types. Clearing the
 *    cache there would empty it continuously and cancel the whole point of
 *    swr.
 *  - `upload-url` only signs a URL. Nothing public changes until the medium
 *    is actually attached to an article or a setting, which is another
 *    write, and that one does clear the cache.
 */
const NEVER = ['/api/admin/preview', '/api/admin/media/upload-url']

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('afterResponse', async (event) => {
    const method = event.method
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return

    const path = event.path.split('?')[0] ?? ''
    if (!path.startsWith('/api/admin/')) return
    if (NEVER.some((excluded) => path.startsWith(excluded))) return

    // A refused write changed nothing: leave the cache alone.
    const status = event.node.res.statusCode
    if (status >= 400) return

    await invalidatePublicCache()
  })
})
