import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article, articleView } from '~~/server/database/schema'

/**
 * Incrémente le compteur de vues d'un article.
 *
 * Aucune adresse IP, aucun cookie, aucun identifiant de visiteur : un
 * entier par article et par jour, et rien d'autre. L'incrément se fait en
 * une seule instruction, sans lecture préalable, donc sans course entre
 * deux requêtes simultanées.
 */
export default defineEventHandler(async (event) => {
  // getValidatedRouterParams et non slugParam.parse() : le premier traduit
  // un échec de validation en 400, le second laisse remonter une ZodError
  // que Nitro transforme en 500. Un slug mal formé est une erreur du
  // client, pas une panne du serveur — et un 500 réveille une astreinte.
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useBase()

  const [trouve] = await db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)

  if (!trouve) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }

  const aujourdhui = new Date().toISOString().slice(0, 10)

  await db
    .insert(articleView)
    .values({ articleId: trouve.id, day: aujourdhui, count: 1 })
    .onConflictDoUpdate({
      target: [articleView.articleId, articleView.day],
      set: { count: sql`${articleView.count} + 1` },
    })

  setResponseStatus(event, 202)
  return { ok: true as const }
})
