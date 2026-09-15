/**
 * Liveness probe. No input, no output: it answers « the process is
 * running », nothing more.
 *
 * This is what the image's HEALTHCHECK queries and, as a consequence,
 * Traefik — which refuses to route to an unhealthy container. Making it
 * depend on the database would render the site unreachable on the slightest
 * PostgreSQL hiccup, when most pages do not need it. The database state is
 * read on /api/health/ready.
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    status: 'ok' as const,
    environment: config.public.appEnv,
    version: config.public.version,
  }
})
