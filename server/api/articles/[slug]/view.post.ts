import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleView } from '~~/server/database/schema'

/**
 * Increments an article's view counter.
 *
 * No IP address, no cookie, no visitor identifier: one integer per article
 * and per day, and nothing else. The increment is a single statement,
 * without a prior read, and therefore without a race between two concurrent
 * requests.
 */
export default defineEventHandler(async (event) => {
  // getValidatedRouterParams and not slugParam.parse(): the former turns a
  // validation failure into a 400, the latter lets a ZodError bubble up,
  // which Nitro turns into a 500. A malformed slug is a client error, not a
  // server failure — and a 500 wakes someone on call.
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useDatabase()

  /*
   * PUBLIÉ, et pas seulement « trouvé ».
   *
   * Sans ce filtre, la route répondait 202 sur un brouillon et 404 sur un
   * slug inconnu : la différence se mesure d'une requête, et suffit à
   * confirmer qu'un article existe à cette adresse. C'est l'oracle que la
   * règle du dépôt interdit — un brouillon répond 404. Accessoirement, un
   * compteur de lecture n'a rien à compter sur ce que personne ne peut
   * lire.
   */
  const [trouve] = await db
    .select({ id: article.id })
    .from(article)
    .where(and(eq(article.slug, slug), eq(article.status, 'published')))
    .limit(1)

  if (!trouve) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  const today = new Date().toISOString().slice(0, 10)

  await db
    .insert(articleView)
    .values({ articleId: trouve.id, day: today, count: 1 })
    .onConflictDoUpdate({
      target: [articleView.articleId, articleView.day],
      set: { count: sql`${articleView.count} + 1` },
    })

  setResponseStatus(event, 202)
  return { ok: true as const }
})
