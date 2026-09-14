import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { sujetsDe } from '~~/server/utils/articles'
import { exigerRole } from '~~/server/utils/auth'

/** Un article, brouillon compris. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)

  const [trouve] = await useBase().select().from(article).where(eq(article.slug, slug)).limit(1)
  if (!trouve) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  return { ...trouve, tags: await sujetsDe(trouve.id) }
})
