import { unfurlRequest } from '#shared/schemas/api'
import { requireRole } from '~~/server/utils/auth'
import { fetchPageHtml, isFetchableUrl, readOpenGraph } from '~~/server/utils/unfurl'

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

  /*
   * Le réseau interne n'est pas dépliable.
   *
   * La requête part DU SERVEUR, vers une adresse écrite par
   * l'utilisateur : sans ce garde, un éditeur pouvait lui faire
   * interroger la base, le tableau de bord du proxy ou l'API de
   * métadonnées du VPS, et lire le résultat dans le titre renvoyé.
   *
   * Réponse vide et non erreur : c'est déjà ce que répond une page
   * illisible, et rien ici n'a à confirmer ce qui existe sur le réseau
   * interne — un refus distinct en serait la carte.
   */
  if (!isFetchableUrl(url)) return nothing

  try {
    const html = await fetchPageHtml(url, { signal: AbortSignal.timeout(10_000) })
    return typeof html === 'string' ? readOpenGraph(html) : nothing
  } catch {
    return nothing
  }
})
