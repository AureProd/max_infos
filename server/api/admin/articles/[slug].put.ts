import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { articleDraft, slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { derivedFields, replaceTags, tagsOf } from '~~/server/utils/articles'
import { requireRole } from '~~/server/utils/auth'

/** Enregistre un article. Le status ne change PAS here : voir status.put.ts. */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const body = await readValidatedBody(event, articleDraft.parse)
  const db = useDatabase()

  const [existing] = await db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  const [update] = await db
    .update(article)
    .set({
      title: body.title,
      dek: body.dek ?? null,
      bodyMd: body.bodyMd,
      ...derivedFields(body.bodyMd),
      coverMediaId: body.coverMediaId ?? null,
      seoTitle: body.seoTitle ?? null,
      seoDescription: body.seoDescription ?? null,
      substackUrl: body.substackUrl ?? null,
      featured: body.featured,
    })
    .where(eq(article.id, existing.id))
    .returning()

  await replaceTags(existing.id, body.tags)
  return { ...update, tags: await tagsOf(existing.id) }
})
