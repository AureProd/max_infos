import { signInOrReject } from '~~/server/utils/auth'

/**
 * Google sign-in: departure and return on the same route.
 *
 * nuxt-auth-utils handles the whole OAuth flow — the anti-CSRF state, the
 * code exchange, fetching the profile. All that is left is the decision
 * that belongs to us: is this address on the allow list?
 */
export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },

  async onSuccess(event, { user }) {
    const profile = user as { email?: string; name?: string; picture?: string }
    if (!profile.email) {
      throw createError({ statusCode: 400, statusMessage: 'Adresse absente du profil Google' })
    }

    const signedIn = await signInOrReject({
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    })

    // Only the IDENTIFIER is sealed in the cookie. The role is re-read from
    // the database on every request: a revoked right takes effect straight
    // away, not after the session's fourteen days.
    await setUserSession(event, { user: { id: signedIn.id } })

    return sendRedirect(event, '/admin')
  },

  onError(event, error) {
    console.error('[auth] échec de la connexion Google :', error.message)
    // To /login and not to /: the banner announcing the failure lives on
    // the sign-in page. Sent to the home page, it could never show — which
    // was the case until a test looked.
    return sendRedirect(event, '/login?signin=failed')
  },
})
