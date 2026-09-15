import { z } from 'zod'

/**
 * Creates a session for a given identifier. TESTS ONLY.
 *
 * This route is a back door by nature: it opens a session without any proof
 * of identity. It exists because the authorization test must be able to
 * present itself as `editor` then as `tech` without going through Google —
 * and that test is the most important guard rail of the project.
 *
 * Two INDEPENDENT locks keep it out of production:
 *
 *  1. The bundle. `nitro.ignore` removes all of server/api/test/ from the
 *     build, unless NUXT_TEST_ROUTES is « true » AT BUILD TIME. By default
 *     the route does not even exist in the image.
 *  2. Runtime. Even when compiled, it refuses to answer if the environment
 *     is not « dev ».
 *
 * One lock would do; two protect against a mistake in either.
 */
export default defineEventHandler(async (event) => {
  const { public: pub } = useRuntimeConfig()
  if (pub.appEnv !== 'dev') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { id } = await readValidatedBody(event, z.object({ id: z.number().int() }).parse)
  await setUserSession(event, { user: { id } })
  return { ok: true as const }
})
