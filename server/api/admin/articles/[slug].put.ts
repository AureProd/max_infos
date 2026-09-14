import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { brouillonArticle, slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { champsDerives, remplacerSujets, sujetsDe } from '~~/server/utils/articles'
import { exigerRole } from '~~/server/utils/auth'

/** Enregistre un article. Le statut ne change PAS ici : voir status.put.ts. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const corps = await readValidatedBody(event, brouillonArticle.parse)
  const db = useBase()

  const [existant] = await db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!existant) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  const [maj] = await db
    .update(article)
    .set({
      title: corps.title,
      dek: corps.dek ?? null,
      bodyMd: corps.bodyMd,
      ...champsDerives(corps.bodyMd),
      coverMediaId: corps.coverMediaId ?? null,
      seoTitle: corps.seoTitle ?? null,
      seoDescription: corps.seoDescription ?? null,
      substackUrl: corps.substackUrl ?? null,
      featured: corps.featured,
    })
    .where(eq(article.id, existant.id))
    .returning()

  await remplacerSujets(existant.id, corps.tags)
  return { ...maj, tags: await sujetsDe(existant.id) }
})
