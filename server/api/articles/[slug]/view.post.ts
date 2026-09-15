import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, articleView } from '~~/server/database/schema'

/**
 * Incrémente le compteur de views d'un article.
 *
 * Aucune adresse IP, aucun cookie, aucun identifiant de visiteur : un
 * entier par article et par day, et rien d'autre. L'incrément se fait en
 * une seule statement, sans lecture préalable, donc sans course entre
 * two requêtes simultanées.
 */
export default defineEventHandler(async (event) => {
  // getValidatedRouterParams et non slugParam.parse() : le first traduit
  // un échec de validation en 400, le second laisse remonter une ZodError
  // que Nitro transforme en 500. Un slug mal formé est une error du
  // client, pas une panne du serveur — et un 500 réveille une astreinte.
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useDatabase()

  const [trouve] = await db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.slug, slug))
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
