import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article, setting } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { DEFAULT_TEMPLATES, resolve, VARIABLES } from '~~/server/utils/templates'

/**
 * Les squelettes de déclinaison d'un article, variables déjà résolues.
 *
 * Le but est que Max parte d'un text à corriger plutôt que d'une page
 * blanche. Le site ne publie rien : il prépare, Max copied et publie
 * lui-même.
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
    titre: a.title,
    chapo: a.dek ?? '',
    url: `${pub.baseUrl.replace(/\/+$/, '')}/article/${a.slug}`,
    tags: '',
    minutes: a.readingMinutes,
    caracteres: a.charCount,
  }

  return {
    variables: VARIABLES,
    linkedin: resolve(models.linkedin, context),
    reel: resolve(models.reel, context),
  }
})
