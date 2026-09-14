import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { slugParam } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { article, setting } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { GABARITS_PAR_DEFAUT, resoudre, VARIABLES } from '~~/server/utils/gabarits'

/**
 * Les squelettes de déclinaison d'un article, variables déjà résolues.
 *
 * Le but est que Max parte d'un texte à corriger plutôt que d'une page
 * blanche. Le site ne publie rien : il prépare, Max copie et publie
 * lui-même.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const { slug } = await getValidatedRouterParams(event, z.object({ slug: slugParam }).parse)
  const db = useBase()

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

  const sujets = await useBase().select().from(setting).where(eq(setting.key, 'templates')).limit(1)

  const modeles = {
    ...GABARITS_PAR_DEFAUT,
    ...((sujets[0]?.value as Record<string, string> | undefined) ?? {}),
  }

  const { public: pub } = useRuntimeConfig()
  const contexte = {
    titre: a.title,
    chapo: a.dek ?? '',
    url: `${pub.baseUrl.replace(/\/+$/, '')}/article/${a.slug}`,
    sujets: '',
    minutes: a.readingMinutes,
    caracteres: a.charCount,
  }

  return {
    variables: VARIABLES,
    linkedin: resoudre(modeles.linkedin, contexte),
    reel: resoudre(modeles.reel, contexte),
  }
})
