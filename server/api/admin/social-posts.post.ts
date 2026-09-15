import { manualPost } from '#shared/schemas/api'
import { useDatabase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { requireRole } from '~~/server/utils/auth'
import { parseInstagramUrl } from '~~/server/utils/links'

/**
 * Enregistre une publication input à la main.
 *
 * C'est la seule voie pour LinkedIn : le scope `r_member_social` est fermé
 * aux fresh applications, donc read ses propres publications est
 * impossible. Contrainte vérifiée, à ne pas réapprendre.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'editor')
  const d = await readValidatedBody(event, manualPost.parse)

  const ref = d.network === 'instagram' ? parseInstagramUrl(d.url) : null

  const [created] = await useDatabase()
    .insert(socialPost)
    .values({
      network: d.network,
      // Pas d'externalId : il vient de l'API. Les NULL étant distincts sous
      // PostgreSQL, plusieurs saisies manuelles coexistent sans conflit.
      externalId: null,
      shortcode: ref?.shortcode ?? null,
      url: d.url,
      permalink: d.url,
      mediaType: d.mediaType ?? (d.network === 'linkedin' ? 'post' : 'image'),
      caption: d.caption ?? null,
      postedAt: d.postedAt ? new Date(`${d.postedAt}T12:00:00Z`) : new Date(),
      source: 'manual',
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
