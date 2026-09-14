import { publicationManuelle } from '#shared/schemas/api'
import { useBase } from '~~/server/database/client'
import { socialPost } from '~~/server/database/schema'
import { exigerRole } from '~~/server/utils/auth'
import { parseInstagramUrl } from '~~/server/utils/liens'

/**
 * Enregistre une publication saisie à la main.
 *
 * C'est la seule voie pour LinkedIn : le scope `r_member_social` est fermé
 * aux nouvelles applications, donc lire ses propres publications est
 * impossible. Contrainte vérifiée, à ne pas réapprendre.
 */
export default defineEventHandler(async (event) => {
  await exigerRole(event, 'editor')
  const d = await readValidatedBody(event, publicationManuelle.parse)

  const ref = d.network === 'instagram' ? parseInstagramUrl(d.url) : null

  const [cree] = await useBase()
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
  return cree
})
