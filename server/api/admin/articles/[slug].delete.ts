import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'

/**
 * Supprime un article. Les liaisons (sujets, déclinaisons, vues) partent en
 * cascade ; les publications sociales et les médias RESTENT — ils existent
 * indépendamment.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)

  const supprimes = await useBase()
    .delete(article)
    .where(eq(article.slug, slug))
    .returning({ slug: article.slug })

  if (supprimes.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })
  }
  return { ok: true as const }
})
