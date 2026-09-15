import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam, statusChange } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'

/**
 * Publishes or unpublishes. Deliberately separate from saving: publishing
 * is an act whose decision must be datable and traceable, not one field
 * among others in a form saved out of habit.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const { status, publishedAt } = await readValidatedBody(event, statusChange.parse)
  const db = useDatabase()

  const [existing] = await db
    .select({ id: article.id, publishedAt: article.publishedAt })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  // The SQL constraint requires it: published implies a date. We supply it
  // rather than letting PostgreSQL throw an error at Max.
  const date =
    status === 'published'
      ? publishedAt
        ? new Date(publishedAt)
        : (existing.publishedAt ?? new Date())
      : existing.publishedAt

  const [update] = await db
    .update(article)
    .set({ status, publishedAt: date })
    .where(eq(article.id, existing.id))
    .returning({ slug: article.slug, status: article.status, publishedAt: article.publishedAt })

  return update
})
