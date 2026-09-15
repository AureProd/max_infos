import { signInOrReject } from '~~/server/utils/auth'

/**
 * Connexion Google : départ et back sur la même route.
 *
 * nuxt-auth-utils tient all le feed OAuth — l'état anti-CSRF, l'échange du
 * code, la récupération du profile. Il ne reste que la décision qui nous
 * appartient : cette adresse est-elle sur la list blanche ?
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

    // Seul l'IDENTIFIANT est scellé dans le cookie. Le rôle est relu en base
    // à chaque requête : un droit retiré prend effet all de suite, et non
    // au bout des quatorze jours de la session.
    await setUserSession(event, { user: { id: signedIn.id } })

    return sendRedirect(event, '/admin')
  },

  onError(event, error) {
    console.error('[auth] échec de la connexion Google :', error.message)
    return sendRedirect(event, '/?connexion=echec')
  },
})
