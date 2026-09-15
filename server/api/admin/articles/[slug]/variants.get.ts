import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, setting } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { DEFAULT_TEMPLATES, resolve, VARIABLES } from '~~/server/utils/templates'

/**
 * An article's variant skeletons, variables already resolved.
 *
 * The point is that Max starts from a text to fix rather than a blank page.
 * The site publishes nothing: it prepares, Max copies and publishes
 * himself.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useDatabase()

  const [a] = await db
    .select({
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      readingMinutes: article.readingMinutes,
      charCount: article.charCount,
    })
    .from(article)
    .where(eq(article.slug, slug))
    .limit(1)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Article introuvable' })

  const tags = await useDatabase()
    .select()
    .from(setting)
    .where(eq(setting.key, 'templates'))
    .limit(1)

  const models = {
    ...DEFAULT_TEMPLATES,
    ...((tags[0]?.value as Record<string, string> | undefined) ?? {}),
  }

  const { public: pub } = useRuntimeConfig()
  const context = {
    title: a.title,
    dek: a.dek ?? '',
    url: `${pub.baseUrl.replace(/\/+$/, '')}/article/${a.slug}`,
    tags: '',
    minutes: a.readingMinutes,
    characters: a.charCount,
  }

  return {
    variables: VARIABLES,
    linkedin: resolve(models.linkedin, context),
    reel: resolve(models.reel, context),
  }
})
