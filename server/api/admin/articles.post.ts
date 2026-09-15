import { articleCreation } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { derivedFields, freeSlug, replaceTags, tagsOf } from '~~/server/utils/articles'
import { requireRole } from '~~/server/utils/auth'

/** Crée un article, toujours en draft. */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const body = await readValidatedBody(event, articleCreation.parse)

  const slug = body.slug ?? (await freeSlug(body.title))

  const [created] = await useDatabase()
    .insert(article)
    .values({
      slug,
      title: body.title,
      dek: body.dek ?? null,
      bodyMd: body.bodyMd,
      ...derivedFields(body.bodyMd),
      // Un article naît TOUJOURS en draft : publier est un geste
      // explicit, jamais un effet de bord de la création.
      status: 'draft',
      coverMediaId: body.coverMediaId ?? null,
      seoTitle: body.seoTitle ?? null,
      seoDescription: body.seoDescription ?? null,
      substackUrl: body.substackUrl ?? null,
      featured: body.featured,
      source: 'site',
    })
    .returning()

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Création impossible' })
  await replaceTags(created.id, body.tags)

  setResponseStatus(event, 201)
  return { ...created, tags: await tagsOf(created.id) }
})
