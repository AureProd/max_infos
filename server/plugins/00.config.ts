import { parseConfig } from '#shared/schemas/config'

/**
 * Validates the configuration when the server starts.
 *
 * The « 00. » prefix guarantees the order: Nitro plugins load
 * alphabetically, and nothing else must run before this check.
 *
 * In production, a missing secret fails the startup rather than opening a
 * half-configured site. That is the rule set in lot 1, carried over as is.
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  parseConfig(config)
})
