import { connecterOuRefuser } from '~~/server/utils/auth'

/**
 * Connexion Google : départ et retour sur la même route.
 *
 * nuxt-auth-utils tient tout le flux OAuth — l'état anti-CSRF, l'échange du
 * code, la récupération du profil. Il ne reste que la décision qui nous
 * appartient : cette adresse est-elle sur la liste blanche ?
 */
export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },

  async onSuccess(event, { user }) {
    const profil = user as { email?: string; name?: string; picture?: string }
    if (!profil.email) {
      throw createError({ statusCode: 400, statusMessage: 'Adresse absente du profil Google' })
    }

    const connecte = await connecterOuRefuser({
      email: profil.email,
      name: profil.name ?? null,
      avatarUrl: profil.picture ?? null,
    })

    // Seul l'IDENTIFIANT est scellé dans le cookie. Le rôle est relu en base
    // à chaque requête : un droit retiré prend effet tout de suite, et non
    // au bout des quatorze jours de la session.
    await setUserSession(event, { user: { id: connecte.id } })

    return sendRedirect(event, '/redaction')
  },

  onError(event, erreur) {
    console.error('[auth] échec de la connexion Google :', erreur.message)
    return sendRedirect(event, '/?connexion=echec')
  },
})
