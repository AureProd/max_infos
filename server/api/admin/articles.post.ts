import { articleCreation } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { freeSlug, replaceTags, tagsOf } from '~~/server/utils/articles'
import { requireRole } from '~~/server/utils/auth'
import { derivedFields } from '~~/server/utils/markdown'

/** Creates an article, always as a draft. */
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
      ...derivedFields(body.bodyHtml),
      // An article is ALWAYS born a draft: publishing is an explicit act,
      // never a side effect of creation.
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
