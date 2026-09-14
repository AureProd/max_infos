import { creationArticle } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article } from '~~/server/database/schema'
import { champsDerives, remplacerSujets, slugLibre, sujetsDe } from '~~/server/utils/articles'
import { exigerRole } from '~~/server/utils/auth'

/** Crée un article, toujours en brouillon. */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const corps = await readValidatedBody(event, creationArticle.parse)

  const slug = corps.slug ?? (await slugLibre(corps.title))

  const [cree] = await useBase()
    .insert(article)
    .values({
      slug,
      title: corps.title,
      dek: corps.dek ?? null,
      bodyMd: corps.bodyMd,
      ...champsDerives(corps.bodyMd),
      // Un article naît TOUJOURS en brouillon : publier est un geste
      // explicite, jamais un effet de bord de la création.
      status: 'draft',
      coverMediaId: corps.coverMediaId ?? null,
      seoTitle: corps.seoTitle ?? null,
      seoDescription: corps.seoDescription ?? null,
      substackUrl: corps.substackUrl ?? null,
      featured: corps.featured,
      source: 'site',
    })
    .returning()

  if (!cree) throw createError({ statusCode: 500, statusMessage: 'Création impossible' })
  await remplacerSujets(cree.id, corps.tags)

  setResponseStatus(event, 201)
  return { ...cree, tags: await sujetsDe(cree.id) }
})
