import { checkDatabase } from '~~/server/database/client'

/**
 * Readiness probe: « does the database answer? ».
 *
 * Deliberately separate from /api/health. Liveness drives Traefik routing —
 * an unhealthy container stops receiving traffic — and tying it to this one
 * would make the site unreachable on the slightest PostgreSQL hiccup. This
 * probe serves deployment checks and monitoring.
 *
 * Returns 503 when the database is unreachable: that is the code
 * orchestrators read, and it must not be confused with an application 500.
 *
 * This path has no automated test, deliberately: @nuxt/test-utils waits for
 * « / » to answer 200 before running the tests, and rendering the home page
 * calls /api/site — so with the database down, the test server never
 * starts. The behaviour was checked by hand.
 *
 * What that failure revealed deserves a decision in lot 9: today an
 * unavailable database brings down the WHOLE SITE, including the pages that
 * could do without it. Nitro's `routeRules` (SWR cache) would let us keep
 * serving the last rendered version.
 */
export default defineEventHandler(async (event) => {
  try {
    const { latencyMs } = await checkDatabase()
    return { status: 'ok' as const, database: 'ok' as const, latencyMs }
  } catch (error) {
    setResponseStatus(event, 503)
    return {
      status: 'degraded' as const,
      database: 'unreachable' as const,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
})
