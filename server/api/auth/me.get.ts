import { currentUser } from '~~/server/utils/auth'

/**
 * The current user, or null.
 *
 * Answers 200 with null rather than 401: the site is public, « nobody is
 * signed in » is a normal state, not an error.
 */
export default defineEventHandler(async (event) => {
  return { user: await currentUser(event) }
})
